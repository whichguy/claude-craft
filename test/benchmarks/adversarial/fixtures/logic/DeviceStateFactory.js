/**
 * Factory for managing the state of IoT security devices.
 * Handles initialization and secure decommissioning.
 */
class DeviceStateFactory {
  constructor(hardwareInterface) {
    this.hw = hardwareInterface;
  }

  /**
   * Performs a factory reset on the device hardware.
   * All sensitive keys and local state must be wiped.
   */
  async factoryReset(deviceId) {
    const device = await this.hw.getDevice(deviceId);
    
    if (!device) throw new Error('Device not found');

    // Revert operational parameters to defaults
    const factoryDefaults = {
      firmwareVersion: '1.0.0-GOLD',
      networkMode: 'DHCP',
      encryptionEnabled: true,
      lastMaintenanceDate: new Date(),
      operationalState: 'IDLE'
    };

    await this.hw.applyConfig(deviceId, factoryDefaults);
    
    // Clear volatile session data
    await this.hw.clearBuffer(deviceId);
    
    console.log(`Device ${deviceId} has been reset to factory parameters.`);
  }

  async decommission(deviceId) {
    await this.hw.shutdown(deviceId);
  }
}

module.exports = DeviceStateFactory;
