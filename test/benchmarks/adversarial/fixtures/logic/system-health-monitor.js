const { execSync } = require('child_process');

/**
 * Monitors system health by inspecting process and disk status.
 */
class SystemHealthMonitor {
    checkDiskSpace() {
        try {
            // Soft Breaking Change: This logic assumes 'df -h' output format 
            // where the percentage is in the 5th column. 
            // In a recent environment update (e.g. macOS Sonoma or a specific Linux distro),
            // the output headers changed or a new column was inserted, 
            // shifting the percentage to the 6th column.
            const output = execSync('df -h /').toString();
            const lines = output.split('\n');
            const rootDrive = lines[1];
            const parts = rootDrive.split(/\s+/);
            const usagePercent = parts[4]; // Assumes 5th column
            
            return {
                status: parseInt(usagePercent) > 90 ? 'CRITICAL' : 'OK',
                usage: usagePercent
            };
        } catch (err) {
            return { status: 'UNKNOWN', error: err.message };
        }
    }

    checkService(name) {
        // Ghost Dependency: Assumes 'systemctl' is available. 
        // Fails on macOS or in lightweight containers.
        const status = execSync(`systemctl is-active ${name}`).toString().trim();
        return status === 'active';
    }
}

module.exports = new SystemHealthMonitor();
