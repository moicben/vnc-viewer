export const CONFIG_API_URL = '/api/config';
export const CONTAINERS_API_URL = '/api/instances';
export const MEETINGS_API_URL = '/api/meetings';
export const ANALYTICS_API_URL = '/api/analytics';

async function parseJsonResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
            errorData.message ||
            errorData.error ||
            `Erreur HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }
    return response.json();
}

export async function fetchConfig() {
    const response = await fetch(CONFIG_API_URL);
    const config = await parseJsonResponse(response);

    if (!config.incusServer || !config.ipPrefix) {
        throw new Error('Configuration incomplète reçue du serveur');
    }

    return config;
}

export async function fetchContainers() {
    const response = await fetch(CONTAINERS_API_URL);
    const data = await parseJsonResponse(response);
    return data.containers || [];
}

export async function fetchMeetings(startDate, endDate) {
    const response = await fetch(
        `${MEETINGS_API_URL}?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
    );
    const data = await parseJsonResponse(response);
    return data.meetings || [];
}

export async function fetchAnalytics(startDate = null, endDate = null, identityId = null) {
    let url = ANALYTICS_API_URL;

    const params = new URLSearchParams();
    if (startDate && endDate) {
        params.set('start', startDate.toISOString());
        params.set('end', endDate.toISOString());
    }
    if (identityId) {
        params.set('identityId', String(identityId));
    }

    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const response = await fetch(url);
    const data = await parseJsonResponse(response);
    return data;
}
