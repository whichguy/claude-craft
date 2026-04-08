# Plan: Zero-Downtime Blue-Green Deployments for ECS Fargate

## Context

The service currently deploys via `ecs-deploy` CLI, which does a rolling update on a single ECS service with a single target group. This causes ~30s downtime during task rotation because the ALB drains the old task before the new one is healthy. We need blue-green deployment with traffic shifting, health-gate validation, and instant rollback.

The approach: maintain two target groups (blue/green), deploy new tasks to the inactive group, validate health, shift ALB listener traffic atomically, then drain the old group. CodeDeploy is the standard AWS mechanism for this with ECS, but it adds operational complexity and is notoriously brittle. Instead, we'll use Terraform-managed ALB listener rules with GitHub Actions orchestrating the traffic shift — this gives us explicit control over every step and keeps rollback as simple as flipping the listener back.

## Git Setup

Create a feature branch from main:

```
git checkout -b feat/blue-green-deploy
```

Work will touch three areas: Terraform infra, GitHub Actions workflow, and a small app-level change for deployment metadata.

---

## Phase 1: Terraform — Dual Target Group Infrastructure

**Intent:** Set up the second target group and wire both into the ALB so we can shift traffic between them. The ECS service itself stays singular — we swap which target group it registers into, not which service is running.

### 1.1 Add the green target group

**File: `terraform/ecs.tf`**

Add a second `aws_lb_target_group` resource alongside the existing one. Rename the existing target group resource to `blue` for clarity.

```hcl
resource "aws_lb_target_group" "blue" {
  name        = "${var.service_name}-blue"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 10
    matcher             = "200"
  }

  deregistration_delay = 30

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_target_group" "green" {
  name        = "${var.service_name}-green"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 10
    matcher             = "200"
  }

  deregistration_delay = 30

  lifecycle {
    create_before_destroy = true
  }
}
```

### 1.2 Parameterize the active target group

**File: `terraform/variables.tf`**

```hcl
variable "active_color" {
  description = "Which target group is currently receiving production traffic (blue or green)"
  type        = string
  default     = "blue"

  validation {
    condition     = contains(["blue", "green"], var.active_color)
    error_message = "active_color must be 'blue' or 'green'."
  }
}
```

### 1.3 Update ALB listener to use the active target group

**File: `terraform/ecs.tf`**

Replace the existing `aws_lb_listener` default action to forward to whichever color is active:

```hcl
locals {
  active_tg  = var.active_color == "blue" ? aws_lb_target_group.blue.arn : aws_lb_target_group.green.arn
  standby_tg = var.active_color == "blue" ? aws_lb_target_group.green.arn : aws_lb_target_group.blue.arn
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = local.active_tg
  }
}
```

### 1.4 Add a test listener for pre-shift validation

**File: `terraform/ecs.tf`**

This listener lets us hit the standby target group directly on port 8443 to validate before shifting production traffic:

```hcl
resource "aws_lb_listener" "test" {
  load_balancer_arn = aws_lb.main.arn
  port              = 8443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = local.standby_tg
  }
}
```

Add a security group rule to allow 8443 inbound (restrict to CI/CD runner IPs or VPC CIDR — not 0.0.0.0/0):

```hcl
resource "aws_security_group_rule" "alb_test_listener" {
  type              = "ingress"
  from_port         = 8443
  to_port           = 8443
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
  security_group_id = aws_security_group.alb.id
  description       = "Test listener for blue-green validation"
}
```

### 1.5 Update ECS service to register with the standby target group on deploy

**File: `terraform/ecs.tf`**

The ECS service's `load_balancer` block should point to the **standby** target group. New tasks register there, get validated via the test listener, then we flip `active_color` to shift traffic.

```hcl
resource "aws_ecs_service" "api" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = local.standby_tg
    container_name   = "api"
    container_port   = 8000
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  # Ignore changes to task_definition — CI/CD manages this
  lifecycle {
    ignore_changes = [task_definition, load_balancer]
  }
}
```

**Important:** The `ignore_changes` on `load_balancer` is critical. Without it, Terraform will try to re-register the service on every apply regardless of what CI/CD has done.

### 1.6 Outputs for CI/CD consumption

**File: `terraform/outputs.tf`**

```hcl
output "blue_target_group_arn" {
  value = aws_lb_target_group.blue.arn
}

output "green_target_group_arn" {
  value = aws_lb_target_group.green.arn
}

output "active_color" {
  value = var.active_color
}

output "test_listener_url" {
  value = "https://${aws_lb.main.dns_name}:8443"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}
```

### 1.7 Terraform state migration

The existing target group resource needs to be moved in state to the new `blue` name:

```
terraform state mv aws_lb_target_group.api aws_lb_target_group.blue
```

Run `terraform plan` after this to confirm no resources are being destroyed — only the green target group and test listener should show as additions.

---

## Phase 2: GitHub Actions — Blue-Green Deploy Workflow

**Intent:** Replace the single `ecs-deploy` step with a multi-stage workflow that deploys to the standby color, validates health through the test listener, shifts traffic by updating the Terraform active_color variable, and provides a manual rollback trigger.

### 2.1 Rewrite the deploy workflow

**File: `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: us-east-1
  ECR_REPO: ${{ vars.ECR_REPO_URL }}
  ECS_CLUSTER: prod
  ECS_SERVICE: api-service
  TF_WORKING_DIR: terraform

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tag }}
      image_uri: ${{ steps.meta.outputs.uri }}
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-arn: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        id: meta
        run: |
          TAG="${GITHUB_SHA::8}-$(date +%s)"
          URI="${ECR_REPO}:${TAG}"
          docker build -t "$URI" \
            --build-arg GIT_SHA="${GITHUB_SHA}" \
            --build-arg DEPLOY_TIME="$(date -u +%FT%TZ)" .
          docker push "$URI"
          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
          echo "uri=${URI}" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-arn: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Determine standby color
        id: color
        run: |
          # Read current active color from Terraform state
          cd $TF_WORKING_DIR
          ACTIVE=$(terraform output -raw active_color 2>/dev/null || echo "blue")
          if [ "$ACTIVE" = "blue" ]; then
            STANDBY="green"
          else
            STANDBY="blue"
          fi
          echo "active=${ACTIVE}" >> "$GITHUB_OUTPUT"
          echo "standby=${STANDBY}" >> "$GITHUB_OUTPUT"
          echo "Deploying to ${STANDBY} (active is ${ACTIVE})"

      - name: Get standby target group ARN
        id: tg
        run: |
          cd $TF_WORKING_DIR
          STANDBY_TG=$(terraform output -raw ${STEPS_COLOR_STANDBY}_target_group_arn)
          TEST_URL=$(terraform output -raw test_listener_url)
          echo "standby_tg_arn=${STANDBY_TG}" >> "$GITHUB_OUTPUT"
          echo "test_url=${TEST_URL}" >> "$GITHUB_OUTPUT"
        env:
          STEPS_COLOR_STANDBY: ${{ steps.color.outputs.standby }}

      - name: Register new task definition
        id: task-def
        run: |
          # Get current task def, update image
          TASK_DEF=$(aws ecs describe-task-definition \
            --task-definition api-service \
            --query 'taskDefinition' \
            --output json)

          NEW_TASK_DEF=$(echo "$TASK_DEF" | jq \
            --arg IMAGE "${{ needs.build-and-push.outputs.image_uri }}" \
            '.containerDefinitions[0].image = $IMAGE |
             del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

          NEW_ARN=$(aws ecs register-task-definition \
            --cli-input-json "$NEW_TASK_DEF" \
            --query 'taskDefinition.taskDefinitionArn' \
            --output text)

          echo "task_def_arn=${NEW_ARN}" >> "$GITHUB_OUTPUT"

      - name: Deploy to standby target group
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --task-definition ${{ steps.task-def.outputs.task_def_arn }} \
            --force-new-deployment

          echo "Waiting for service stability..."
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE

      - name: Validate health on test listener
        id: health-check
        run: |
          TEST_URL="${{ steps.tg.outputs.test_url }}"
          MAX_ATTEMPTS=10
          ATTEMPT=0

          while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            ATTEMPT=$((ATTEMPT + 1))
            echo "Health check attempt ${ATTEMPT}/${MAX_ATTEMPTS}..."

            HTTP_CODE=$(curl -s -o /tmp/health_response -w "%{http_code}" \
              "${TEST_URL}/health" --max-time 5 -k || echo "000")

            if [ "$HTTP_CODE" = "200" ]; then
              echo "Health check passed"
              cat /tmp/health_response
              echo ""
              exit 0
            fi

            echo "Got HTTP ${HTTP_CODE}, retrying in 5s..."
            sleep 5
          done

          echo "::error::Health check failed after ${MAX_ATTEMPTS} attempts"
          cat /tmp/health_response 2>/dev/null || true
          exit 1

      - name: Shift traffic to standby (make it active)
        if: success()
        run: |
          cd $TF_WORKING_DIR
          terraform apply -auto-approve \
            -var="active_color=${{ steps.color.outputs.standby }}" \
            -target=aws_lb_listener.https \
            -target=aws_lb_listener.test

      - name: Rollback on failure
        if: failure() && steps.health-check.outcome == 'failure'
        run: |
          echo "::warning::Health check failed — rolling back"
          # Revert to previous task definition
          PREV_TASK_DEF=$(aws ecs describe-services \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE \
            --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition | [0]' \
            --output text)

          # The old tasks on the active TG are still serving traffic.
          # Just update the service back to the old task def so standby is clean.
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --task-definition "$PREV_TASK_DEF"

          echo "Rollback complete. Active color unchanged: ${{ steps.color.outputs.active }}"
```

### 2.2 Add manual rollback workflow

**File: `.github/workflows/rollback.yml`**

For instant manual rollback — just flip the listener back to the previous color:

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      target_color:
        description: 'Color to make active (blue or green)'
        required: true
        type: choice
        options:
          - blue
          - green

permissions:
  id-token: write
  contents: read

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-arn: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1

      - name: Shift traffic
        run: |
          cd terraform
          terraform apply -auto-approve \
            -var="active_color=${{ inputs.target_color }}" \
            -target=aws_lb_listener.https \
            -target=aws_lb_listener.test

      - name: Verify health
        run: |
          ALB_URL=$(cd terraform && terraform output -raw alb_dns_name)
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${ALB_URL}/health" --max-time 10 -k)
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::error::Health check failed after rollback (HTTP ${HTTP_CODE})"
            exit 1
          fi
          echo "Rollback to ${{ inputs.target_color }} verified healthy"
```

---

## Phase 3: Application — Deployment Metadata Endpoint

**Intent:** Add a lightweight way to verify which version is running on which color, useful for debugging and confirming traffic shifted correctly.

### 3.1 Expose build metadata

**File: `app/main.py`**

Add to the existing `/health` endpoint or create a separate `/health/deployment` endpoint:

```python
import os

@app.get("/health/deployment")
async def deployment_info():
    return {
        "git_sha": os.environ.get("GIT_SHA", "unknown"),
        "deploy_time": os.environ.get("DEPLOY_TIME", "unknown"),
        "color": os.environ.get("DEPLOY_COLOR", "unknown"),
    }
```

### 3.2 Pass build args through to runtime

**File: `Dockerfile`**

```dockerfile
ARG GIT_SHA=unknown
ARG DEPLOY_TIME=unknown
ENV GIT_SHA=${GIT_SHA}
ENV DEPLOY_TIME=${DEPLOY_TIME}
```

---

## Phase 4: Security Group and Network Considerations

**Intent:** Make sure the test listener is not exposed to the internet and that both target groups can receive health checks.

### 4.1 Restrict test listener access

The security group rule in Phase 1.4 already restricts port 8443 to the VPC CIDR. If CI/CD runners are outside the VPC (e.g., GitHub-hosted runners), you have two options:

- **Option A (preferred):** Run the health check step using a self-hosted runner inside the VPC.
- **Option B:** Use an AWS CLI call to check target group health instead of curling the test listener directly:

```bash
aws elbv2 describe-target-health \
  --target-group-arn "$STANDBY_TG_ARN" \
  --query 'TargetHealthDescriptions[*].TargetHealth.State' \
  --output text
```

This avoids needing network access to the test listener from CI/CD at all. The ALB health checks run inside the VPC regardless. Update the health check step in Phase 2.1 accordingly if going with Option B.

### 4.2 Ensure both target groups can receive ALB health checks

Both target groups' health checks hit `/health` on port 8000. The ECS task security group (`aws_security_group.ecs_tasks`) must allow inbound from the ALB security group on port 8000. This should already exist — verify it does.

---

## Verification

After merging and deploying:

1. **Terraform plan shows clean state:** Run `terraform plan` with current `active_color=blue` — should show no changes (infrastructure already applied).

2. **First deploy goes to green:** Push a commit to main. Workflow should:
   - Build image, push to ECR
   - Register new task definition
   - Deploy to ECS (tasks register with green TG)
   - Hit test listener on 8443, confirm `/health` returns 200
   - Run `terraform apply -var="active_color=green"` to shift traffic
   - Production traffic now hits green

3. **Verify zero downtime:** During the traffic shift step, monitor the ALB with:
   ```
   while true; do curl -s -o /dev/null -w "%{http_code}\n" https://your-alb-url/health; sleep 0.5; done
   ```
   Should see continuous 200s with no 502/503 responses.

4. **Rollback test:** Trigger the rollback workflow, select "blue". Traffic should shift back within seconds (just a listener rule update, no new tasks needed).

5. **Confirm deployment metadata:** Hit `/health/deployment` on production — should show the git SHA and deploy time of the active version.

---

## Migration Path

Since the existing setup has a single target group, the migration order matters:

1. Merge the Terraform changes first. Run `terraform state mv` for the existing target group rename, then `terraform apply`. This adds the green TG and test listener — no disruption to the running service.
2. Merge the workflow changes. The next deploy will use the new blue-green flow.
3. Monitor the first 2-3 deploys closely to confirm the health check timing is right. Adjust `MAX_ATTEMPTS` and sleep intervals if the service takes longer to boot (e.g., DB migrations, model loading).

## Risks and Mitigations

- **Terraform state drift:** If someone manually changes the listener outside Terraform, `active_color` will be out of sync. Mitigation: add a pre-deploy step that reads the actual listener target group ARN and compares it to Terraform state.
- **Long-running requests during traffic shift:** The ALB listener swap is atomic for new connections, but in-flight requests on the old target group will complete (governed by `deregistration_delay`). The 30s deregistration delay handles this.
- **DB migrations:** If a deploy includes a DB migration, the old version (still serving on the active color) might break. This plan does NOT solve that — DB migrations need a separate strategy (expand-contract pattern). Flag this if the team runs migrations as part of deploy.
