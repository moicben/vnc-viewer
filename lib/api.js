export const CONFIG_API_URL = '/api/config';
export const CONTAINERS_API_URL = '/api/instances';
export const MEETINGS_API_URL = '/api/meetings';

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
