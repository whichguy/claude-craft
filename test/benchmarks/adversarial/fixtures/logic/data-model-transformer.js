/**
 * Handles transformation of raw input data into internal domain models.
 */
const DataModelTransformer = {
    // Refactored from sourceId to originId
    transform(record) {
        const { originId, payload, timestamp } = record;
        
        const processPayload = (data) => {
            // Partial Refactor: The developer renamed sourceId to originId above,
            // but forgot to update it here. This destructuring will yield undefined.
            const { sourceId, metadata } = data;
            
            return {
                id: sourceId || originId,
                data: metadata ? { ...payload, ...metadata } : payload,
                processedAt: timestamp || Date.now()
            };
        };

        return processPayload(payload);
    }
};

module.exports = {
    // Exporting with the new name
    originTransformer: DataModelTransformer.transform,
    validateModel: (model) => !!model.id
};
