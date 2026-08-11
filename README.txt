NotaKeeperLeague 1.0 Production

Recommended draft-night workflow:
1. Open the app while connected to the internet.
2. Go to Live Sync and select TEST LIVE CONNECTIONS.
3. Confirm Sleeper and the consensus ranking feed show OK.
4. Select REFRESH ALL LIVE DATA.
5. Review any quarantined changes.
6. Select PREPARE FOR DRAFT NIGHT to validate, snapshot, and lock the player dataset.
7. Use the Draft Night screen during the live draft.

If internet drops after the dataset is locked, the app continues using its locally cached data.

Production hosting:
For live sync, offline caching, service-worker updates, and Add to Home Screen,
use a stable HTTPS deployment rather than a temporary file link.
