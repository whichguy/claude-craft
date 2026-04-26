# GitOps for Multi-Region EKS with FluxCD, Helm, and Istio

## Context
This project aims to establish a highly available, secure, and automated multi-region Kubernetes infrastructure on AWS. By utilizing a GitOps methodology with FluxCD, the entire system state—from infrastructure components like Istio and External Secrets Operator to application-level Helm charts—is managed through a single source of truth in Git. The architecture spans two AWS regions (`us-east-1` and `eu-west-1`) to ensure disaster recovery and low-latency access for global users.

## Git Setup
The repository will follow a "modular repository" structure to allow for shared configuration and region-specific overrides.

```text
.
├── clusters/
│   ├── us-east-1/          # Region-specific Flux configuration
│   │   ├── flux-system/
│   │   └── infrastructure.yaml
│   └── eu-west-1/
│       ├── flux-system/
│       └── infrastructure.yaml
├── infrastructure/         # Shared component definitions
│   ├── base/
│   │   ├── istio/
│   │   ├── external-secrets/
│   │   └── sources/        # HelmRepository and GitRepository sources
│   └── configs/            # Common CRDs and ConfigMaps
└── apps/                   # Application HelmReleases
    ├── base/
    └── overlays/
        ├── prod-us/
        └── prod-eu/
```

## Implementation Steps

### Phase 1: Infrastructure Foundations & FluxCD Bootstrap
**Intent:** Provision the EKS clusters and bootstrap FluxCD to take ownership of the cluster state.

**Files:**
- `clusters/us-east-1/flux-system/gotk-components.yaml`
- `clusters/us-east-1/flux-system/gotk-sync.yaml`

**Bootstrap Command:**
```bash
flux bootstrap github \
  --owner=$GITHUB_USER \
  --repository=k8s-gitops-infra \
  --branch=main \
  --path=clusters/us-east-1 \
  --personal
```

### Phase 2: Shared Infrastructure Deployment
**Intent:** Deploy core platform services (Istio, External Secrets Operator) using Flux `HelmRelease` objects.

**Files:**
- `infrastructure/base/sources/helm-repos.yaml`
- `infrastructure/base/istio/helm-release.yaml`

**Example HelmRelease (Istio):**
```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: istio-base
  namespace: istio-system
spec:
  interval: 1h
  chart:
    spec:
      chart: base
      version: "1.20.x"
      sourceRef:
        kind: HelmRepository
        name: istio
        namespace: flux-system
  install:
    crds: CreateReplace
```

### Phase 3: External Secrets & AWS Integration
**Intent:** Securely synchronize secrets from AWS Secrets Manager into Kubernetes Secrets using IAM Roles for Service Accounts (IRSA).

**Files:**
- `infrastructure/base/external-secrets/cluster-secret-store.yaml`

**Code Block:**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-irsa
```

### Phase 4: Istio Service Mesh Configuration
**Intent:** Enable mTLS by default across all namespaces and configure cross-region traffic splitting.

**Files:**
- `infrastructure/base/istio/mesh-config.yaml`

**Code Block:**
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

### Phase 5: Application Delivery with Helm
**Intent:** Deploy microservices using Helm charts with environment-specific value overrides for each region.

**Files:**
- `apps/base/api-service/helm-release.yaml`
- `apps/overlays/prod-us/values-override.yaml`

**Code Block:**
```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: api-service
  namespace: prod
spec:
  valuesFrom:
    - kind: ConfigMap
      name: region-specific-config
  chart:
    spec:
      chart: ./charts/api-service
      sourceRef:
        kind: GitRepository
        name: flux-system
```

## Verification

| Component | Verification Method | Expected Result |
| :--- | :--- | :--- |
| **FluxCD** | `flux get kustomizations` | All status show `Ready: True` |
| **Istio** | `istioctl analyze -A` | No validation errors found |
| **Secrets** | `kubectl get externalsecrets -A` | Status is `SecretSynced` |
| **mTLS** | `istioctl proxy-config secret <pod>` | Certificates are valid and loaded |

## Risks and Mitigations

| Risk | Mitigation Strategy |
| :--- | :--- |
| **Secret Exposure** | Enforce IRSA (IAM Roles for Service Accounts) so the node never has access to secrets; only specific pods can assume the role. |
| **Drift from Git** | Enable Flux `driftDetection` to automatically revert manual `kubectl` changes. |
| **Region Outage** | Use Route53 Health Checks to failover traffic between regions at the DNS level. |
| **Sync Deadlocks** | Use `dependsOn` in Flux Kustomizations to ensure infrastructure (CRDs) is ready before apps are deployed. |
