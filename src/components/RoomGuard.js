import { useEffect, useRef } from 'react';
import socketService from '../network/socketService';
import { dialog } from './Dialog';
import { t as tr } from '../i18n';

/**
 * Partie interrompue : si le serveur a redémarré (mise à jour, panne) ou si la place du joueur est perdue,
 * on le prévient au lieu de laisser une table figée. En tournoi, on le ramène sur la page du tournoi :
 * le match reprend dès que les deux camps y sont (sinon il serait compté absent, puis forfait).
 */
export default function RoomGuard({ navigation, roomId, tournamentId }) {
    const shown = useRef(false);
    const wasDown = useRef(false);

    useEffect(() => {
        if (!roomId) return undefined;
        const interrupted = () => {
            if (shown.current) return;
            shown.current = true;
            const message = tournamentId
                ? tr("La connexion avec le serveur a été coupée et cette partie s'est arrêtée. Retourne sur la page du tournoi : ton match reprend dès que les deux camps y sont.")
                : tr("La connexion avec le serveur a été coupée et cette partie s'est arrêtée.");
            dialog.alert(tr('Partie interrompue'), message, [{
                text: tournamentId ? tr('Retour au tournoi') : tr("Retour à l'accueil"),
                onPress: () => {
                    socketService.leaveRoom(roomId);
                    if (tournamentId) navigation.navigate('Tournament', { id: tournamentId });
                    else navigation.navigate('Home');
                },
            }]);
        };
        const offGone = socketService.onRoomGone((d) => { if (!d?.roomId || d.roomId === roomId) interrupted(); });
        const offDown = socketService.onDisconnect(() => { wasDown.current = true; });
        const offUp = socketService.onConnect(() => {
            if (!wasDown.current) return;
            wasDown.current = false;
            // Connexion retrouvée telle quelle (micro-coupure) : rien à faire, la partie continue
            if (socketService.socket?.recovered) return;
            socketService.roomCheck(roomId, (r) => { if (r && !r.ok) interrupted(); });
        });
        return () => { offGone(); offDown && offDown(); offUp && offUp(); };
    }, [roomId, tournamentId]);

    return null;
}
