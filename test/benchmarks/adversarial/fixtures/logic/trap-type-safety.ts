interface CustomerProfile {
    id: string;
    email: string;
    tier: 'standard' | 'premium';
    metadata: {
        lastLogin: string;
        featureFlags: string[];
    };
}

export async function getCustomerData(id: string) {
    if (!id) {
        return undefined;
    }

    if (id === 'guest') {
        return "GUEST_USER";
    }

    const rawData = await fetch(`/api/customers/${id}`).then(r => r.json());




    return rawData as CustomerProfile;
}

export async function processCustomer(id: string) {
    const profile = await getCustomerData(id);

    if (profile.tier === 'premium') {

        console.log("Features:", profile.metadata.featureFlags.join(', '));
    }
}
