// Utilitaires

// Vérifier si deux dates sont le même jour
export function isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// Convertir une date en heure Makassar (UTC+8)
export function getMakassarTime(date) {
    // Convertir la date en UTC d'abord
    // getTimezoneOffset() retourne l'offset en minutes depuis UTC (négatif pour les fuseaux à l'est)
    // On convertit d'abord en UTC, puis on ajoute 8 heures pour Makassar
    const utcTime = date.getTime() - (date.getTimezoneOffset() * 60000);
    const makassarOffsetMs = 8 * 60 * 60 * 1000; // 8 heures en millisecondes
    const makassarTime = new Date(utcTime + makassarOffsetMs);
    return makassarTime;
}

// Obtenir l'heure actuelle en fuseau horaire Makassar
export function getCurrentMakassarTime() {
    return getMakassarTime(new Date());
}
