
function _main(module, exports) {

    const utils = require('utils');

    function calculate(val) {
        return utils.multiply(val, 2);
    }

    module.exports = function init(config) {
        return {
            run: () => calculate(config.start)
        };
    };
}


function __global_init__(config) {
    return _main({}, {}).init(config); 
}
