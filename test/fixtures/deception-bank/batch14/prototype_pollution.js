function deepMerge(target, source) {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return target;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

module.exports = { deepMerge };
