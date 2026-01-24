export const REFRESH_INTERVAL = 30000;

export function extractHostname(url) {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname;
    } catch {
        return url.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    }
}

export function normalizeBaseUrl(url) {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
}

export function buildVncUrl(incusServer, ip) {
    const baseUrl = normalizeBaseUrl(incusServer);
    const host = extractHostname(baseUrl);
    if (!baseUrl || !ip) return '';
    return `${baseUrl}/vnc.html#host=${host}&port=443&autoconnect=true&scaling=local&path=websockify?token=${ip}`;
}

export function isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

export function getMakassarTime(date) {
    const utcTime = date.getTime() - date.getTimezoneOffset() * 60000;
    const makassarOffsetMs = 8 * 60 * 60 * 1000;
    return new Date(utcTime + makassarOffsetMs);
}

export function getCurrentMakassarTime() {
    return getMakassarTime(new Date());
}
