package com.enterprise.security;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Robust, hierarchical permission management system.
 * Supports granular permissions with inheritance from parent resources.
 */
public class PermissionManager {

    private final Map<String, ResourceNode> resourceTree = new ConcurrentHashMap<>();
    private final String rootRole = "ADMIN";

    public enum Policy {
        ALLOW,
        DENY,
        INHERIT
    }

    public static class ResourceNode {
        private final String name;
        private final String parentName;
        private final Map<String, Policy> rolePolicies = new HashMap<>();

        public ResourceNode(String name, String parentName) {
            this.name = name;
            this.parentName = parentName;
        }

        public void setPolicy(String role, Policy policy) {
            rolePolicies.put(role, policy);
        }

        public Policy getPolicy(String role) {
            return rolePolicies.getOrDefault(role, Policy.INHERIT);
        }

        public Optional<String> getParentName() {
            return Optional.ofNullable(parentName);
        }
    }

    public void registerResource(String name, String parentName) {
        resourceTree.put(name, new ResourceNode(name, parentName));
    }

    public void setPolicy(String resourceName, String role, Policy policy) {
        ResourceNode node = resourceTree.get(resourceName);
        if (node != null) {
            node.setPolicy(role, policy);
        }
    }

    /**
     * Checks if a role is permitted to access a resource.
     * Uses hierarchical resolution: if a policy is set to INHERIT,
     * it checks the parent resource.
     */
    public boolean isPermitted(String resourceName, String role) {
        // Administrative override
        if (rootRole.equals(role)) {
            return true;
        }

        ResourceNode current = resourceTree.get(resourceName);
        if (current == null) {
            // If resource is unknown, we default to deny for safety
            return false;
        }

        return resolvePolicy(current, role) == Policy.ALLOW;
    }

    private Policy resolvePolicy(ResourceNode node, String role) {
        Policy p = node.getPolicy(role);

        if (p == Policy.INHERIT) {
            return node.getParentName()
                .map(resourceTree::get)
                .map(parent -> resolvePolicy(parent, role))
                .orElse(Policy.ALLOW); // Default root policy
        }

        return p;
    }
}
