// Gestion du calendrier

import { calendar, calendarView, containersView, containersControls, calendarHeader, countEl, viewSwitcher, prevWeekBtn, nextWeekBtn, calendarWeekTitle, identityFilter, loading, error, loadingText } from './dom.js';
import { loadMeetingsFromAPI } from './api.js';
import { isSameDay, getCurrentMakassarTime } from './utils.js';

// État de la vue
export let currentView = 'containers'; // 'containers' ou 'calendar'
let currentDate = null; // Date de début de la vue (aujourd'hui + 3 jours suivants)
let meetings = []; // Liste des meetings de la période affichée
let filteredMeetings = []; // Liste des meetings filtrés
let selectedIdentityFilter = 'all'; // Filtre d'identité sélectionné

// Initialiser la date actuelle (aujourd'hui)
export function initCurrentWeek() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    currentDate = new Date(now);
}

// Mettre à jour l'affichage du switcher de vue
export function updateViewSwitcher() {
    if (!viewSwitcher) return;
    
    viewSwitcher.setAttribute('data-view', currentView);
    const options = viewSwitcher.querySelectorAll('.view-option');
    const indicator = viewSwitcher.querySelector('.view-switcher-indicator');
    
    options.forEach((option, index) => {
        if (option.dataset.view === currentView) {
            option.classList.add('active');
            if (indicator) {
                let left = 0;
                for (let i = 0; i < index; i++) {
                    left += options[i].offsetWidth;
                }
                const width = option.offsetWidth;
                indicator.style.width = `${width}px`;
                indicator.style.transform = `translateX(${left}px)`;
            }
        } else {
            option.classList.remove('active');
        }
    });
}

// Basculer entre les vues
export function switchView() {
    if (currentView === 'containers') {
        if (containersView) containersView.style.display = '';
        if (calendarView) calendarView.style.display = 'none';
        if (containersControls) containersControls.style.display = '';
        if (calendarHeader) calendarHeader.style.display = 'none';
        if (countEl) countEl.style.display = '';
    } else if (currentView === 'calendar') {
        if (containersView) containersView.style.display = 'none';
        if (calendarView) calendarView.style.display = '';
        if (containersControls) containersControls.style.display = 'none';
        if (calendarHeader) calendarHeader.style.display = 'flex';
        if (countEl) countEl.style.display = 'none';
        loadMeetings();
        // Recalculer les hauteurs après le rendu
        setTimeout(() => {
            updateCalendarHeights();
        }, 100);
    }
}

// Mettre à jour les hauteurs des conteneurs de meetings et recalculer les positions
export function updateCalendarHeights() {
    if (!calendar || currentView !== 'calendar') return;
    
    const calendarElement = calendar;
    const calendarGridElement = calendar.querySelector('.calendar-grid');
    const dayContainers = calendar.querySelectorAll('.calendar-day-meetings');
    
    if (calendarElement && calendarGridElement && dayContainers.length > 0) {
        // Calculer la nouvelle hauteur d'un slot de 30 minutes
        let slotHeight = 28; // Valeur par défaut
        const firstTimeCell = calendarGridElement.querySelector('.calendar-time-cell[style*="grid-row: 2"]');
        if (firstTimeCell) {
            const cellHeight = firstTimeCell.offsetHeight;
            slotHeight = cellHeight / 2;
        }
        
        dayContainers.forEach(container => {
            // Le conteneur est un item de la CSS grid (grid-row: 2 / -1), donc 100% suffit.
            container.style.height = '100%';
            
            // Recalculer les positions de tous les meetings dans ce conteneur
            const meetings = container.querySelectorAll('.calendar-meeting');
            meetings.forEach(meeting => {
                // Utiliser les attributs data pour recalculer les positions
                const startSlot = parseFloat(meeting.getAttribute('data-start-slot') || '0');
                const heightSlots = parseFloat(meeting.getAttribute('data-height-slots') || '1');
                
                // Appliquer la nouvelle hauteur de slot
                meeting.style.top = `${startSlot * slotHeight}px`;
                meeting.style.height = `${heightSlots * slotHeight}px`;
            });
        });
        
        // Recalculer la position de la barre d'heure actuelle
        const timeIndicator = calendarGridElement.querySelector('.calendar-current-time-indicator');
        if (timeIndicator) {
            // Obtenir l'heure actuelle en fuseau horaire Makassar
            const makassarNow = getCurrentMakassarTime();
            const localHour = makassarNow.getHours();
            const localMinutes = makassarNow.getMinutes();
            
            if (localHour >= 7 && localHour < 17) {
                const minutesFrom7AM = (localHour - 7) * 60 + localMinutes;
                const slotPosition = minutesFrom7AM / 30;
                const topPosition = slotPosition * slotHeight;
                
                const timeLine = timeIndicator.querySelector('.calendar-current-time-line');
                const timeBullet = timeIndicator.querySelector('.calendar-current-time-bullet');
                const timeLabel = timeIndicator.querySelector('.calendar-current-time-label');
                
                if (timeLine) timeLine.style.top = `${topPosition}px`;
                if (timeBullet) timeBullet.style.top = `${topPosition - 5}px`;
                if (timeLabel) {
                    timeLabel.style.top = `${topPosition - 10}px`;
                    const timeStr = `${String(localHour).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
                    timeLabel.textContent = timeStr;
                }
                timeIndicator.style.display = '';
            } else {
                timeIndicator.style.display = 'none';
            }
        }
    }
}

// Écouter les changements de taille de fenêtre
window.addEventListener('resize', () => {
    if (currentView === 'calendar') {
        updateCalendarHeights();
    }
});

// Extraire les identités uniques des meetings
function extractUniqueIdentities(meetings) {
    const identities = new Set();
    meetings.forEach(meeting => {
        const identity = meeting.identities;
        const fullname = identity?.fullname;
        if (fullname) {
            identities.add(fullname);
        }
    });
    return Array.from(identities).sort();
}

// Mettre à jour le select avec les identités disponibles
function updateIdentityFilter(meetings) {
    if (!identityFilter) return;
    
    const currentValue = identityFilter.value;
    const identities = extractUniqueIdentities(meetings);
    
    // Garder l'option "All" et vider les autres
    identityFilter.innerHTML = '<option value="all">All</option>';
    
    // Ajouter les identités
    identities.forEach(fullname => {
        const option = document.createElement('option');
        option.value = fullname;
        option.textContent = fullname;
        identityFilter.appendChild(option);
    });
    
    // Restaurer la valeur sélectionnée si elle existe toujours
    if (currentValue === 'all' || identities.includes(currentValue)) {
        identityFilter.value = currentValue;
        selectedIdentityFilter = currentValue;
    } else {
        identityFilter.value = 'all';
        selectedIdentityFilter = 'all';
    }
}

// Appliquer le filtre d'identité
function applyIdentityFilter() {
    if (selectedIdentityFilter === 'all') {
        filteredMeetings = meetings;
    } else {
        filteredMeetings = meetings.filter(meeting => {
            const identity = meeting.identities;
            const fullname = identity?.fullname;
            return fullname === selectedIdentityFilter;
        });
    }
}

// Charger les meetings depuis l'API
export async function loadMeetings() {
    if (!calendar || !loading || !error) return;
    
    if (!currentDate) {
        initCurrentWeek();
    }
    
    try {
        if (loading) {
            loading.style.display = 'block';
            if (loadingText) loadingText.textContent = 'Chargement des meetings...';
        }
        error.style.display = 'none';
        
        // Calculer la fin de la période (4 jours : aujourd'hui + 3 jours suivants)
        const endDate = new Date(currentDate);
        endDate.setDate(currentDate.getDate() + 3);
        endDate.setHours(23, 59, 59, 999);
        
        meetings = await loadMeetingsFromAPI(currentDate, endDate);
        
        // Mettre à jour le filtre d'identité avec les nouveaux meetings
        updateIdentityFilter(meetings);
        
        // Appliquer le filtre
        applyIdentityFilter();
        
        updateCalendarWeekTitle();
        renderCalendar();
        
    } catch (err) {
        console.error('Erreur lors de la récupération des meetings:', err);
        if (error) {
            error.textContent = `Erreur lors de la récupération des meetings: ${err.message}`;
            error.style.display = 'block';
        }
        meetings = [];
        filteredMeetings = [];
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// Mettre à jour le titre de la période (4 jours)
function updateCalendarWeekTitle() {
    if (!calendarWeekTitle || !currentDate) return;
    
    const endDate = new Date(currentDate);
    endDate.setDate(currentDate.getDate() + 3);
    endDate.setHours(0, 0, 0, 0);
    
    const options = { day: 'numeric', month: 'long' };
    const startStr = currentDate.toLocaleDateString('fr-FR', options);
    const endStr = endDate.toLocaleDateString('fr-FR', options);
    
    // Vérifier si aujourd'hui est dans la plage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isTodayInRange = today >= currentDate && today <= endDate;
    
    if (isTodayInRange && currentDate.getTime() === today.getTime()) {
        calendarWeekTitle.textContent = `Aujourd'hui - ${endStr}`;
    } else {
        calendarWeekTitle.textContent = `${startStr} - ${endStr}`;
    }
    
    // Rendre le titre cliquable pour revenir à aujourd'hui
    calendarWeekTitle.style.cursor = 'pointer';
    calendarWeekTitle.title = 'Cliquer pour revenir à aujourd\'hui';
    calendarWeekTitle.onclick = () => {
        initCurrentWeek();
        loadMeetings();
    };
}

// Calculer les positions et largeurs des meetings qui se chevauchent pour un jour
function calculateMeetingPositions(dayMeetings) {
    if (dayMeetings.length === 0) return [];
    
    // Préparer les meetings avec leurs dates de début et fin
    const preparedMeetings = dayMeetings.map(meeting => {
        const start = new Date(meeting.meeting_start_at);
        const duration = meeting.meeting_duration_minutes || 30;
        const end = new Date(start.getTime() + duration * 60 * 1000);
        return { ...meeting, start, end, duration };
    }).sort((a, b) => a.start - b.start);
    
    // Pour chaque meeting, trouver tous ceux qui se chevauchent avec lui
    const positionedMeetings = preparedMeetings.map(meeting => {
        // Trouver tous les meetings qui se chevauchent avec ce meeting
        const overlapping = preparedMeetings.filter(other => 
            meeting.start < other.end && other.start < meeting.end
        );
        
        // Trier les meetings qui se chevauchent par heure de début
        const sortedOverlapping = [...overlapping].sort((a, b) => a.start - b.start);
        
        // Trouver la position de ce meeting dans le groupe qui se chevauche
        const position = sortedOverlapping.findIndex(m => m === meeting);
        const maxConcurrent = sortedOverlapping.length;
        
        // Calculer la largeur (chaque meeting prend 1/n de l'espace disponible)
        const width = 1 / maxConcurrent;
        
        return {
            ...meeting,
            position: position / maxConcurrent,
            width: width
        };
    });
    
    return positionedMeetings;
}

// Rendre le calendrier
function renderCalendar() {
    if (!calendar) return;
    
    if (!currentDate) {
        initCurrentWeek();
    }
    
    // Créer la structure du calendrier - seulement 4 jours
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const hours = Array.from({ length: 10 }, (_, i) => i + 7); // 7-16
    
    // Créer les 4 jours à afficher (aujourd'hui + 3 jours suivants) en UTC
    const daysToShow = [];
    for (let i = 0; i < 4; i++) {
        // Créer la date en UTC pour la comparaison avec les meetings
        const dayDateUTC = new Date(Date.UTC(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() + i,
            0, 0, 0, 0
        ));
        
        // Créer aussi une date locale pour l'affichage
        const dayDateLocal = new Date(currentDate);
        dayDateLocal.setDate(currentDate.getDate() + i);
        dayDateLocal.setHours(0, 0, 0, 0);
        
        const dayName = dayNames[dayDateLocal.getDay()];
        const dayNumber = dayDateLocal.getDate();
        const month = dayDateLocal.toLocaleDateString('fr-FR', { month: 'short' });
        
        daysToShow.push({
            dateUTC: dayDateUTC,  // Pour la comparaison avec les meetings (UTC)
            dateLocal: dayDateLocal,  // Pour l'affichage
            name: dayName,
            display: `${dayName} ${dayNumber} ${month}`
        });
    }
    
    // Grouper les meetings par jour en utilisant UTC
    const meetingsByDay = {};
    daysToShow.forEach((dayInfo, dayIndex) => {
        // Utiliser UTC pour la comparaison avec les meetings
        const dayStartUTC = new Date(dayInfo.dateUTC);
        const dayEndUTC = new Date(Date.UTC(
            dayInfo.dateUTC.getUTCFullYear(),
            dayInfo.dateUTC.getUTCMonth(),
            dayInfo.dateUTC.getUTCDate(),
            23, 59, 59, 999
        ));
        
        meetingsByDay[dayIndex] = filteredMeetings.filter(meeting => {
            if (!meeting.meeting_start_at) return false;
            const meetingStart = new Date(meeting.meeting_start_at);
            // Comparer en UTC
            return meetingStart >= dayStartUTC && meetingStart <= dayEndUTC;
        });
    });
    
    // Calculer les positions des meetings pour chaque jour
    const positionedMeetingsByDay = {};
    Object.keys(meetingsByDay).forEach(dayIndex => {
        positionedMeetingsByDay[dayIndex] = calculateMeetingPositions(meetingsByDay[dayIndex]);
    });
    
    let html = '<div class="calendar-grid">';

    // Coin haut-gauche (vide) + en-têtes des jours en colonnes
    html += '<div class="calendar-time-column calendar-corner"></div>';
    daysToShow.forEach((dayInfo, dayIndex) => {
        // Comparer avec la date locale pour l'affichage "today"
        const isToday = isSameDay(dayInfo.dateLocal, new Date());
        const gridColumn = dayIndex + 2; // 1 = colonne des heures
        const meetingCount = meetingsByDay[dayIndex]?.length || 0;

        html += `<div class="calendar-day-header ${isToday ? 'today' : ''}" style="grid-row: 1; grid-column: ${gridColumn};">
            <div class="day-name">${dayInfo.display} <span class="meeting-count">${meetingCount}</span></div>
        </div>`;
    });

    // Grille: heures (lignes) × jours (colonnes) - UI allégée avec une ligne par heure
    hours.forEach((hour, hourIndex) => {
        const gridRow = hourIndex + 2; // 1 = en-tête

        // Afficher uniquement l'heure (ex: "08h" au lieu de "08:00" et "08:30")
        const timeStr = `${String(hour).padStart(2, '0')}h`;
        html += `<div class="calendar-time-cell" style="grid-row: ${gridRow}; grid-column: 1;">${timeStr}</div>`;

        daysToShow.forEach((dayInfo, dayIndex) => {
            // Pour la détection "now", vérifier si on est dans cette heure (peu importe les minutes)
            const dayDate = new Date(dayInfo.dateLocal);
            dayDate.setHours(hour, 0, 0, 0);

            const now = new Date();
            const isNow = isSameDay(dayDate, now) &&
                         dayDate.getHours() === now.getHours();

            const gridColumn = dayIndex + 2;
            html += `<div class="calendar-cell ${isNow ? 'now' : ''}" style="grid-row: ${gridRow}; grid-column: ${gridColumn};"></div>`;
        });
    });

    html += '</div>';
    calendar.innerHTML = html;
    
    // Attendre que le DOM soit mis à jour pour calculer les hauteurs
    setTimeout(() => {
        // Calculer la hauteur d'un slot de 30 minutes en fonction de la hauteur réelle des cellules
        const calendarGrid = calendar.querySelector('.calendar-grid');
        let slotHeight = 28; // Valeur par défaut
        if (calendarGrid) {
            // Trouver une cellule de la première ligne d'heure pour mesurer sa hauteur
            const firstTimeCell = calendarGrid.querySelector('.calendar-time-cell[style*="grid-row: 2"]');
            if (firstTimeCell) {
                const cellHeight = firstTimeCell.offsetHeight;
                // Chaque ligne représente 1 heure, donc un slot de 30 minutes = la moitié
                slotHeight = cellHeight / 2;
            }
        }
        
        // Ajouter les meetings avec positionnement absolu dans chaque colonne de jour
        Object.keys(positionedMeetingsByDay).forEach(dayIndex => {
            const dayMeetings = positionedMeetingsByDay[dayIndex];
            if (dayMeetings.length === 0) return;
            
            // Créer un conteneur pour les meetings de ce jour qui couvre toute la colonne
            const dayContainer = document.createElement('div');
            dayContainer.className = 'calendar-day-meetings';
            dayContainer.setAttribute('data-day-index', dayIndex);
            dayContainer.style.gridColumn = `${parseInt(dayIndex) + 2}`;
            dayContainer.style.gridRow = '2 / -1';
            dayContainer.style.pointerEvents = 'none';
            dayContainer.style.zIndex = '10';
            dayContainer.style.padding = '0';
            dayContainer.style.margin = '0';
            dayContainer.style.width = '100%';
            dayContainer.style.maxWidth = '100%';
            dayContainer.style.height = '100%';
            dayContainer.style.overflow = 'hidden';
            dayContainer.style.boxSizing = 'border-box';
            dayContainer.style.clipPath = 'inset(0)';
            
            // Ajouter le conteneur au grid
            if (calendarGrid) {
                calendarGrid.appendChild(dayContainer);
            }
    
        dayMeetings.forEach(meeting => {
            const meetingStart = new Date(meeting.meeting_start_at);
            const duration = meeting.duration || 30;
            // Utiliser UTC pour le calcul de la position (les meetings sont en UTC)
            const startMinutes = meetingStart.getUTCHours() * 60 + meetingStart.getUTCMinutes();
            const startSlot = (startMinutes - 7 * 60) / 30; // Position précise en slots - plage 7h-16h UTC
            const heightSlots = duration / 30;
            
            if (startSlot < 0 || startSlot >= 20) return; // Hors de la plage 7h-16h (10 heures × 2 créneaux = 20 slots)
            
            const identity = meeting.identities;
            const bookerName = identity?.fullname || meeting.participant_email || 'Inconnu';
            const company = identity?.company || '';
            const organizerEmail = meeting.participant_email || identity?.email || '';
            const title = meeting.meeting_title || 'Meeting';
            
            const meetingElement = document.createElement('div');
            meetingElement.className = 'calendar-meeting';
            const leftPercent = meeting.position * 100;
            const widthPercent = meeting.width * 100;
            
            // S'assurer que le meeting ne dépasse jamais 100% de la largeur du conteneur
            const maxLeft = 100 - widthPercent;
            const clampedLeft = Math.min(leftPercent, maxLeft);
            const clampedWidth = Math.min(widthPercent, 100 - clampedLeft);
            
            meetingElement.style.position = 'absolute';
            meetingElement.style.left = `${clampedLeft}%`;
            meetingElement.style.width = `${clampedWidth}%`;
            meetingElement.style.maxWidth = `${100 - clampedLeft}%`;
            meetingElement.style.top = `${startSlot * slotHeight}px`;
            meetingElement.style.height = `${heightSlots * slotHeight}px`;
            meetingElement.style.zIndex = meeting.position + 1;
            meetingElement.style.pointerEvents = 'auto';
            meetingElement.style.boxSizing = 'border-box';
            meetingElement.style.paddingLeft = '4px';
            meetingElement.style.paddingRight = '4px';
            meetingElement.style.overflow = 'hidden';
            meetingElement.title = `${title} - ${bookerName}${company ? ' (' + company + ')' : ''}`;
            // Stocker les informations de slot pour le recalcul lors du redimensionnement
            meetingElement.setAttribute('data-start-slot', startSlot.toString());
            meetingElement.setAttribute('data-height-slots', heightSlots.toString());
            
            meetingElement.innerHTML = `
                <div class="meeting-title">${title}</div>
                <div class="meeting-booker">${organizerEmail || 'Email non disponible'}</div>
            `;
            
            // Ajouter l'event listener pour ouvrir la popup
            meetingElement.addEventListener('click', (e) => {
                e.stopPropagation();
                showMeetingPopup(meeting);
            });
            
            dayContainer.appendChild(meetingElement);
        });
        });
        
        // Supprimer l'ancienne barre d'heure actuelle si elle existe
        const existingIndicator = calendarGrid.querySelector('.calendar-current-time-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Ajouter la barre d'heure actuelle (basée sur le fuseau horaire local)
        addCurrentTimeIndicator(calendarGrid, slotHeight);
        
        // Mettre à jour les hauteurs après le rendu
        updateCalendarHeights();
    }, 0);
}

// Ajouter la barre d'heure actuelle basée sur le fuseau horaire Makassar (UTC+8)
function addCurrentTimeIndicator(calendarGrid, slotHeight) {
    if (!calendarGrid) return;
    
    // Obtenir l'heure actuelle en fuseau horaire Makassar (UTC+8)
    const makassarNow = getCurrentMakassarTime();
    const localHour = makassarNow.getHours();
    const localMinutes = makassarNow.getMinutes();
    
    // Vérifier si l'heure actuelle est dans la plage affichée (7h-16h)
    if (localHour < 7 || localHour >= 17) return;
    
    // Trouver le jour actuel dans la période affichée (4 jours)
    // Utiliser UTC pour la comparaison avec les jours affichés (qui sont en UTC)
    const todayUTC = new Date();
    const todayUTCStart = new Date(Date.UTC(
        todayUTC.getUTCFullYear(),
        todayUTC.getUTCMonth(),
        todayUTC.getUTCDate(),
        0, 0, 0, 0
    ));
    
    // Trouver l'index du jour actuel dans les 4 jours affichés
    let currentDayIndex = -1;
    if (!currentDate) {
        initCurrentWeek();
    }
    
    for (let dayIndex = 0; dayIndex < 4; dayIndex++) {
        // Créer la date du jour en UTC pour la comparaison
        const dayDateUTC = new Date(Date.UTC(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() + dayIndex,
            0, 0, 0, 0
        ));
        
        // Comparer les dates en UTC
        if (dayDateUTC.getUTCFullYear() === todayUTCStart.getUTCFullYear() &&
            dayDateUTC.getUTCMonth() === todayUTCStart.getUTCMonth() &&
            dayDateUTC.getUTCDate() === todayUTCStart.getUTCDate()) {
            currentDayIndex = dayIndex;
            break;
        }
    }
    
    // Si le jour actuel n'est pas dans la semaine affichée, ne pas afficher la barre
    if (currentDayIndex === -1) return;
    
    // Calculer la position verticale précise
    // Position en minutes depuis 7h du matin
    const minutesFrom7AM = (localHour - 7) * 60 + localMinutes;
    // Convertir en slots de 30 minutes
    const slotPosition = minutesFrom7AM / 30;
    // Position en pixels
    const topPosition = slotPosition * slotHeight;
    
    // Créer la barre d'heure actuelle qui traverse toutes les colonnes du jour actuel
    const timeIndicator = document.createElement('div');
    timeIndicator.className = 'calendar-current-time-indicator';
    timeIndicator.style.gridColumn = `${currentDayIndex + 2}`;
    timeIndicator.style.gridRow = '2 / -1';
    timeIndicator.style.position = 'relative';
    timeIndicator.style.pointerEvents = 'none';
    timeIndicator.style.zIndex = '1000';
    timeIndicator.style.overflow = 'visible';
    
    // Créer la ligne horizontale qui traverse toute la colonne
    const timeLine = document.createElement('div');
    timeLine.className = 'calendar-current-time-line';
    timeLine.style.position = 'absolute';
    timeLine.style.top = `${topPosition}px`;
    timeLine.style.left = '0';
    timeLine.style.width = '100%';
    timeLine.style.height = '3px';
    timeLine.style.backgroundColor = '#4a9eff';
    timeLine.style.boxShadow = '0 0 6px rgba(74, 158, 255, 0.8), 0 0 12px rgba(74, 158, 255, 0.4)';
    timeLine.style.borderRadius = '2px';
    
    // Créer le point/bullet à gauche dans la colonne des heures
    const timeBullet = document.createElement('div');
    timeBullet.className = 'calendar-current-time-bullet';
    timeBullet.style.position = 'absolute';
    timeBullet.style.top = `${topPosition - 5}px`;
    timeBullet.style.left = '-8px';
    timeBullet.style.width = '12px';
    timeBullet.style.height = '12px';
    timeBullet.style.backgroundColor = '#4a9eff';
    timeBullet.style.borderRadius = '50%';
    timeBullet.style.boxShadow = '0 0 8px rgba(74, 158, 255, 1)';
    timeBullet.style.border = '2px solid #0a0a0a';
    timeBullet.style.zIndex = '1001';
    
    // Créer un label avec l'heure actuelle
    const timeLabel = document.createElement('div');
    timeLabel.className = 'calendar-current-time-label';
    const timeStr = `${String(localHour).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
    timeLabel.textContent = timeStr;
    timeLabel.style.position = 'absolute';
    timeLabel.style.top = `${topPosition - 10}px`;
    timeLabel.style.left = '4px';
    timeLabel.style.backgroundColor = '#4a9eff';
    timeLabel.style.color = '#fff';
    timeLabel.style.padding = '2px 6px';
    timeLabel.style.borderRadius = '4px';
    timeLabel.style.fontSize = '11px';
    timeLabel.style.fontWeight = '600';
    timeLabel.style.fontFamily = 'Monaco, Menlo, Courier New, monospace';
    timeLabel.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    timeLabel.style.zIndex = '1001';
    timeLabel.style.whiteSpace = 'nowrap';
    
    timeIndicator.appendChild(timeLine);
    timeIndicator.appendChild(timeBullet);
    timeIndicator.appendChild(timeLabel);
    
    calendarGrid.appendChild(timeIndicator);
    
    // Mettre à jour la position toutes les minutes
    const updatePosition = () => {
        // Vérifier que le jour actuel est toujours dans la vue (en UTC)
        const todayUTC = new Date();
        const todayUTCStart = new Date(Date.UTC(
            todayUTC.getUTCFullYear(),
            todayUTC.getUTCMonth(),
            todayUTC.getUTCDate(),
            0, 0, 0, 0
        ));
        
        let dayIndex = -1;
        if (currentDate) {
            for (let i = 0; i < 4; i++) {
                // Créer la date du jour en UTC pour la comparaison
                const dayDateUTC = new Date(Date.UTC(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    currentDate.getDate() + i,
                    0, 0, 0, 0
                ));
                
                // Comparer en UTC
                if (dayDateUTC.getUTCFullYear() === todayUTCStart.getUTCFullYear() &&
                    dayDateUTC.getUTCMonth() === todayUTCStart.getUTCMonth() &&
                    dayDateUTC.getUTCDate() === todayUTCStart.getUTCDate()) {
                    dayIndex = i;
                    break;
                }
            }
        }
        
        // Si le jour actuel n'est plus dans la vue, masquer l'indicateur
        if (dayIndex === -1) {
            timeIndicator.style.display = 'none';
            return;
        }
        
        // Mettre à jour la colonne si nécessaire
        if (timeIndicator.style.gridColumn !== `${dayIndex + 2}`) {
            timeIndicator.style.gridColumn = `${dayIndex + 2}`;
        }
        
        // Obtenir l'heure actuelle en fuseau horaire Makassar
        const makassarNow = getCurrentMakassarTime();
        const localHour = makassarNow.getHours();
        const localMinutes = makassarNow.getMinutes();
        
        if (localHour < 7 || localHour >= 17) {
            timeIndicator.style.display = 'none';
            return;
        }
        
        const minutesFrom7AM = (localHour - 7) * 60 + localMinutes;
        const slotPosition = minutesFrom7AM / 30;
        const topPosition = slotPosition * slotHeight;
        
        timeLine.style.top = `${topPosition}px`;
        timeBullet.style.top = `${topPosition - 5}px`;
        timeLabel.style.top = `${topPosition - 10}px`;
        const timeStr = `${String(localHour).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
        timeLabel.textContent = timeStr;
        timeIndicator.style.display = '';
    };
    
    // Mettre à jour immédiatement et toutes les minutes
    setInterval(updatePosition, 60000); // Toutes les minutes
    updatePosition();
}

// Afficher la popup avec les détails complets du meeting
function showMeetingPopup(meeting) {
    const popup = document.getElementById('meetingPopup');
    const popupTitle = popup.querySelector('.meeting-popup-title');
    const popupDateTime = document.getElementById('meetingPopupDateTime');
    const popupCreatedAt = document.getElementById('meetingPopupCreatedAt');
    const popupInternalId = document.getElementById('meetingPopupInternalId');
    const popupBooker = document.getElementById('meetingPopupBooker');
    const popupEmail = document.getElementById('meetingPopupEmail');
    const popupUrl = document.getElementById('meetingPopupUrl');
    const popupClose = popup.querySelector('.meeting-popup-close');
    const popupOverlay = popup.querySelector('.meeting-popup-overlay');
    
    if (!popup) return;
    
    const meetingStart = new Date(meeting.meeting_start_at);
    const identity = meeting.identities;
    const title = meeting.meeting_title || 'Meeting';
    const organizerEmail = meeting.participant_email || '';
    const identityEmail = identity?.email || '';
    const meetingUrl = meeting.meeting_url || '';
    
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC'
    };
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'UTC'
    };
    
    const dateStr = meetingStart.toLocaleDateString('fr-FR', dateOptions);
    const timeStr = meetingStart.toLocaleTimeString('fr-FR', timeOptions);
    const dateTimeStr = `${dateStr} à ${timeStr} UTC`;
    
    let createdAtStr = 'Non renseigné';
    if (meeting.created_at) {
        const createdAt = new Date(meeting.created_at);
        const createdAtDateStr = createdAt.toLocaleDateString('fr-FR', dateOptions);
        const createdAtTimeStr = createdAt.toLocaleTimeString('fr-FR', timeOptions);
        createdAtStr = `${createdAtDateStr} à ${createdAtTimeStr}`;
    }
    
    popupTitle.textContent = title;
    popupDateTime.textContent = dateTimeStr;
    popupCreatedAt.textContent = createdAtStr;
    popupInternalId.textContent = meeting.internal_id || 'Non renseigné';
    popupBooker.textContent = organizerEmail || 'Non renseigné';
    popupEmail.textContent = identityEmail || 'Non renseigné';
    
    if (meetingUrl) {
        popupUrl.href = meetingUrl;
        popupUrl.textContent = meetingUrl;
        popupUrl.style.pointerEvents = 'auto';
        popupUrl.style.color = '#4a9eff';
    } else {
        popupUrl.textContent = 'Non renseigné';
        popupUrl.href = '#';
        popupUrl.style.pointerEvents = 'none';
        popupUrl.style.color = '#666';
    }
    
    popup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    const closePopup = () => {
        popup.style.display = 'none';
        document.body.style.overflow = '';
        popupClose.removeEventListener('click', closePopup);
        popupOverlay.removeEventListener('click', closePopup);
    };
    
    popupClose.addEventListener('click', closePopup);
    popupOverlay.addEventListener('click', closePopup);
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closePopup();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Configurer le switcher de vue
export function setupViewSwitcher() {
    if (!viewSwitcher) return;
    
    viewSwitcher.addEventListener('click', (e) => {
        const clickedView = e.target.dataset.view;
        if (clickedView && clickedView !== currentView) {
            currentView = clickedView;
            updateViewSwitcher();
            switchView();
        }
    });
    
    // Navigation jour précédent
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            if (!currentDate) {
                initCurrentWeek();
            }
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() - 1);
            currentDate.setHours(0, 0, 0, 0);
            loadMeetings();
        });
    }
    
    // Navigation jour suivant
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            if (!currentDate) {
                initCurrentWeek();
            }
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            loadMeetings();
        });
    }
    
    // Configurer le filtre d'identité
    if (identityFilter) {
        identityFilter.addEventListener('change', (e) => {
            selectedIdentityFilter = e.target.value;
            applyIdentityFilter();
            renderCalendar();
        });
    }
}
