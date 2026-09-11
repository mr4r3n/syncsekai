import type { LucideIcon } from 'lucide-react';
import { Sparkles, Link2, Tv, Layers, History, GitMerge, ShieldBan, Sliders, Shield } from 'lucide-react';

/*
 * La guía de uso, como documento y no como interfaz.
 *
 * Cada sección es texto en orden de lectura con, como mucho, un recorte de la
 * pantalla donde las palabras no bastan. Los recortes son todos del mismo
 * sitio —inglés, tema claro, 2560 de ancho— y se regeneran de golpe con
 * scripts/capturar-guia.js.
 *
 * Marcado en línea, y sólo este: **negrita** para lo que hay que pulsar o leer
 * en pantalla, y [texto](/ruta) para enlazar a la pantalla de la que se habla.
 */

export type BloqueGuia =
  | { tipo: 'p'; texto: string }
  | { tipo: 'pasos'; items: string[] }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'captura'; src: string; alt: string; pie?: string }
  | { tipo: 'codigo'; id: string; etiqueta: string; texto: string }
  | { tipo: 'nota'; texto: string; tono?: 'info' | 'aviso' };

export interface SeccionGuia {
  id: string;
  categoria: 'inicio' | 'conectar' | 'usar' | 'ajustes';
  icono: LucideIcon;
  titulo: string;
  resumen: string;
  /** La pantalla de la que trata; el botón de la cabecera lleva ahí. */
  pantalla?: { href: string; etiqueta: string };
  bloques: BloqueGuia[];
}

export const CATEGORIAS: Array<{ id: SeccionGuia['categoria']; en: string; es: string }> = [
  { id: 'inicio', en: 'Start', es: 'Inicio' },
  { id: 'conectar', en: 'Connect', es: 'Conectar' },
  { id: 'usar', en: 'Use', es: 'Uso' },
  { id: 'ajustes', en: 'Settings', es: 'Ajustes' },
];

/*
 * Plantilla para el plugin "Webhook" de Jellyfin. TODOS los campos van entre
 * comillas como string, incluidos los numéricos: si Handlebars resuelve una
 * variable a vacío y no estuviera entre comillas, el JSON quedaría inválido en
 * vez de llegar con un campo vacío. El backend hace la coerción numérica.
 */
const PLANTILLA_JELLYFIN = `{
  "NotificationType": "{{NotificationType}}",
  "ServerName": "{{ServerName}}",
  "NotificationUsername": "{{NotificationUsername}}",
  "ItemType": "{{ItemType}}",
  "ItemId": "{{ItemId}}",
  "LibraryName": "{{LibraryName}}",
  "Name": "{{Name}}",
  "SeriesName": "{{SeriesName}}",
  "SeasonNumber": "{{SeasonNumber}}",
  "EpisodeNumber": "{{EpisodeNumber}}",
  "PlaybackPositionTicks": "{{PlaybackPositionTicks}}",
  "RunTimeTicks": "{{RunTimeTicks}}"
}`;

/*
 * La de Emby usa los mismos nombres de campo. No se ha podido comprobar contra
 * un servidor con Emby Premiere, que es lo que exige el plugin nativo de
 * webhooks; el camino verificado es la conexión directa por URL y clave de API,
 * que no necesita ni plantilla ni Premiere.
 */
const PLANTILLA_EMBY = PLANTILLA_JELLYFIN;

const CAP = '/docs/screenshots';

export const GUIA: Record<'en' | 'es', SeccionGuia[]> = {
  en: [
    {
      id: 'quickstart',
      categoria: 'inicio',
      icono: Sparkles,
      titulo: 'Getting started',
      resumen: 'What SyncSekai does and the three things you need to set up.',
      pantalla: { href: '/connections', etiqueta: 'Open Connections' },
      bloques: [
        { tipo: 'p', texto: 'SyncSekai watches what you play on your media server — **Plex**, **Jellyfin** or **Emby** — and updates your anime lists on **AniList**, **MyAnimeList** and **Kitsu** so you don\'t have to. When you finish an episode, the tracker moves to the next one. That is the whole idea.' },
        { tipo: 'p', texto: 'Everything else in this guide is detail. To get syncing you need exactly three things, all on the [Connections](/connections) page:' },
        { tipo: 'pasos', items: [
          'Link at least one **tracker** — AniList, MyAnimeList or Kitsu. This is where your progress goes.',
          'Link your **media server** — Plex, Jellyfin or Emby. This is where the progress comes from.',
          'Watch something. The first sync shows up in [Sync History](/history) within a few seconds of finishing an episode.',
        ] },
        { tipo: 'nota', texto: 'You can link more than one tracker at the same time. Each one gets the same update.' },
        { tipo: 'p', texto: 'If a title doesn\'t match — a split season, an OVA filed under the main series, two shows with the same name — that is what [Title Mapping](/mappings) is for. Most libraries never need it; the ones that do, need it for a handful of titles.' },
      ],
    },
    {
      id: 'trackers',
      categoria: 'conectar',
      icono: Link2,
      titulo: 'Link a tracker',
      resumen: 'AniList, MyAnimeList and Kitsu. Where your progress ends up.',
      pantalla: { href: '/connections', etiqueta: 'Open Connections' },
      bloques: [
        { tipo: 'p', texto: 'Go to [Connections](/connections) and scroll to **Linked anime accounts**. Each tracker has its own card.' },
        { tipo: 'captura', src: `${CAP}/trackers.webp`, alt: 'The three tracker cards: AniList, MyAnimeList and Kitsu, each with Disconnect and Re-authenticate buttons', pie: 'With all three linked. An unlinked card shows a Link button instead.' },
        { tipo: 'p', texto: '**AniList** and **MyAnimeList** use OAuth: click **Link**, approve SyncSekai on their site, and you are sent back. SyncSekai never sees your password for those accounts, and you can revoke access from the tracker\'s own settings at any time.' },
        { tipo: 'p', texto: '**Kitsu** is different. Its API only offers a password login, so the card asks for your Kitsu email and password. They are exchanged for a token and **the password is not kept**. If that trade-off doesn\'t suit you, skip Kitsu.' },
        { tipo: 'lista', items: [
          '**Re-authenticate** — use it if a tracker starts failing after it worked. Tokens expire; this gets a fresh one without losing anything.',
          '**Disconnect** — removes the token. Your list on the tracker is untouched.',
        ] },
        { tipo: 'nota', texto: 'Trackers go down. When one of them is unreachable, syncs to it fail and are recorded as failures in Sync History — that is the tracker, not your setup. They will succeed again when it is back.', tono: 'aviso' },
      ],
    },
    {
      id: 'plex',
      categoria: 'conectar',
      icono: Tv,
      titulo: 'Plex',
      resumen: 'Link your server and choose libraries. The webhook is optional.',
      pantalla: { href: '/connections', etiqueta: 'Open Connections' },
      bloques: [
        { tipo: 'p', texto: 'Once your server is linked, SyncSekai asks it every few seconds what is playing. That is all it needs: **no Plex Pass, nothing to install**. Two steps.' },
        { tipo: 'pasos', items: [
          'In [Connections](/connections), click **Link Server** on the Plex card. A window opens on plex.tv — approve it, then pick your server from the list. If your server isn\'t listed, you can enter its URL and token by hand.',
          'Under **Plex libraries to monitor**, tick the libraries that contain anime and click **Save selection**. Only what you play in those libraries is synced; a film in another library is ignored.',
        ] },
        { tipo: 'nota', texto: 'The one requirement: SyncSekai has to be able to reach your server at the URL you linked. A server that is only visible inside your home network won\'t work with the hosted instance — use the webhook below instead, or self-host.', tono: 'aviso' },
        { tipo: 'p', texto: 'To check it works, play an episode and look at [Sync History](/history). The entry appears when the episode passes your watch threshold (85% by default — see [Sync rules](/settings/rules)).' },
        { tipo: 'p', texto: '**Optional: the webhook.** If you have **Plex Pass**, Plex can also push events to SyncSekai the moment they happen. It is instant rather than a few seconds behind, and it works even if your server isn\'t reachable from the internet, because the connection goes from Plex outward. Copy **Your private webhook URL**, then in Plex Web go to **Settings → Webhooks**, click **Add Webhook**, paste it and save.' },
        { tipo: 'captura', src: `${CAP}/plex-webhook.webp`, alt: 'The private webhook URL box on the Plex card, with a Copy button', pie: 'The URL is unique to your account. Treat it like a password.' },
        { tipo: 'nota', texto: 'Both can be on at the same time. If the webhook and the session watcher report the same episode, only one sync goes out.' },
      ],
    },
    {
      id: 'jellyfin',
      categoria: 'conectar',
      icono: Tv,
      titulo: 'Jellyfin',
      resumen: 'Link with an API key and install the Webhook plugin.',
      pantalla: { href: '/connections', etiqueta: 'Open Connections' },
      bloques: [
        { tipo: 'pasos', items: [
          'In Jellyfin, create an API key: **Dashboard → API Keys → +**. Name it anything.',
          'In [Connections](/connections), click **Link Jellyfin Server**, enter your server URL and the key, and save. SyncSekai reads your libraries; tick the ones with anime and **Save selection**.',
          'Install the **Webhook** plugin in Jellyfin (**Dashboard → Plugins → Catalog**), restart Jellyfin, then open the plugin and click **Add Generic Destination**.',
          'Paste your webhook URL from the Jellyfin card as the destination URL, tick the **Playback Progress** and **Playback Stop** notification types, tick your user, and paste the template below into the **Template** field. Save.',
        ] },
        { tipo: 'captura', src: `${CAP}/jellyfin-webhook.webp`, alt: 'The private webhook URL box on the Jellyfin card', pie: 'Same idea as Plex: one URL per account.' },
        { tipo: 'codigo', id: 'jellyfin-template', etiqueta: 'Webhook template', texto: PLANTILLA_JELLYFIN },
        { tipo: 'nota', texto: 'Every field in the template is quoted, including the numbers. That is on purpose: if the plugin resolves a variable to nothing, a quoted field arrives empty and is ignored, whereas an unquoted one makes the whole JSON invalid.' },
        { tipo: 'p', texto: 'Jellyfin does not send a progress percentage on its own; SyncSekai works it out from **PlaybackPositionTicks** and **RunTimeTicks**, which is why both are in the template.' },
      ],
    },
    {
      id: 'emby',
      categoria: 'conectar',
      icono: Tv,
      titulo: 'Emby',
      resumen: 'Link with an API key. No plugin needed.',
      pantalla: { href: '/connections', etiqueta: 'Open Connections' },
      bloques: [
        { tipo: 'p', texto: 'Emby is the simplest of the three. SyncSekai polls your server\'s active sessions every few seconds, so there is nothing to install on the Emby side.' },
        { tipo: 'pasos', items: [
          'In Emby, create an API key: **Settings → Advanced → API Keys → New API Key**.',
          'In [Connections](/connections), click **Link Emby Server**, enter the server URL and the key, save, and choose the libraries to monitor.',
        ] },
        { tipo: 'captura', src: `${CAP}/emby-card.webp`, alt: 'The Emby card before linking, with a Link Emby Server button' },
        { tipo: 'p', texto: 'Emby also has a native webhook feature, but it requires **Emby Premiere**. If you have it, the card shows a webhook URL you can paste there with the template below. If you don\'t, ignore it — the session watcher syncs just the same.' },
        { tipo: 'codigo', id: 'emby-template', etiqueta: 'Webhook template (Premiere only)', texto: PLANTILLA_EMBY },
        { tipo: 'nota', texto: 'The Emby webhook template has not been verified against a server with Premiere. The direct connection has. If you try the webhook and it misbehaves, please report it.', tono: 'aviso' },
      ],
    },
    {
      id: 'catalog',
      categoria: 'usar',
      icono: Layers,
      titulo: 'Catalog',
      resumen: 'Your lists, pulled live from the trackers.',
      pantalla: { href: '/catalog', etiqueta: 'Open Catalog' },
      bloques: [
        { tipo: 'p', texto: 'The [Catalog](/catalog) shows your anime list as the tracker sees it right now — it is fetched live, not stored. Pick the tracker with the pills on the right; **Local** shows what SyncSekai itself has recorded, which is useful when a tracker is down.' },
        { tipo: 'captura', src: `${CAP}/catalog-filters.webp`, alt: 'The catalog header: status tabs on the left, tracker pills, search and view toggle on the right' },
        { tipo: 'lista', items: [
          'The tabs filter by status: **Watching**, **Completed**, **Planned**, **Paused / Dropped**, **Favourites**.',
          'The toggle next to the search box switches between a poster grid and a compact list.',
          'Open a title to see its episodes. You can mark progress from there directly, without going to the tracker.',
        ] },
        { tipo: 'nota', texto: 'Because it is live, the catalog is only as fast as the tracker. If it comes up empty, check the tracker\'s status in Connections before assuming something is wrong on your side.' },
      ],
    },
    {
      id: 'history',
      categoria: 'usar',
      icono: History,
      titulo: 'Sync history',
      resumen: 'Every sync, what each tracker said, and how to undo one.',
      pantalla: { href: '/history', etiqueta: 'Open Sync History' },
      bloques: [
        { tipo: 'p', texto: '[Sync History](/history) is the record of everything SyncSekai has done. When something looks wrong on a tracker, this is the first place to look.' },
        { tipo: 'captura', src: `${CAP}/history-rows.webp`, alt: 'History rows with the episode, date and watch percentage, and a badge per tracker', pie: 'One row per episode. The badges on the right are one per tracker.' },
        { tipo: 'p', texto: 'Each row shows the episode, when it was watched, the watch percentage, and one badge per linked tracker:' },
        { tipo: 'lista', items: [
          '**Green tick** — the tracker accepted the update.',
          '**Red cross** — it was rejected or the tracker was unreachable. Hover for the reason.',
          '**Grey** — skipped, usually because the title is blacklisted or the episode had already been synced.',
        ] },
        { tipo: 'p', texto: 'The **Errors** tab shows only rows with at least one failure. The bin icon **reverts** a sync: it deletes the row and moves the tracker back one episode, which is how you fix an accidental scrobble.' },
        { tipo: 'p', texto: 'The calendar on the right is your viewing pace by day, and the numbers above it are counted from this same history — nothing there is estimated.' },
      ],
    },
    {
      id: 'mappings',
      categoria: 'usar',
      icono: GitMerge,
      titulo: 'Title mapping',
      resumen: 'When the server\'s name for a show and the tracker\'s don\'t match.',
      pantalla: { href: '/mappings', etiqueta: 'Open Title Mapping' },
      bloques: [
        { tipo: 'p', texto: 'SyncSekai matches titles automatically, and for most shows that is the end of it. The cases that need help are always the same ones: a second season the server files as **Season 2** but the tracker lists as a separate entry, an OVA inside the main season, a title that two different shows share, or a name in a different language.' },
        { tipo: 'p', texto: 'A **mapping** is the answer: "this title and season on my server is this entry on the tracker". Once saved, every future episode uses it.' },
        { tipo: 'captura', src: `${CAP}/mappings-row.webp`, alt: 'Mapping rows, one linked and one pending approval with an Approve button', pie: 'A pending row is a guess SyncSekai isn\'t sure about. Approve it or edit it.' },
        { tipo: 'lista', items: [
          '**Linked** rows are confirmed. **Pending** rows are automatic guesses below the confidence bar — check them and click **Approve**, or **Edit** to point them somewhere else.',
          '**New Mapping** creates one by hand: type the title as your server shows it, the season, and search the tracker for the right entry.',
          '**Make global** shares a mapping with every user of this instance. Only administrators can do it; global mappings show up under the **Global** tab.',
          '**Import** and **Export** move your mappings as a file, so a rebuilt library doesn\'t start from zero.',
        ] },
        { tipo: 'nota', texto: 'If a show synced to the wrong entry, fix the mapping first and then revert the wrong rows in Sync History. The other way round, the next episode would go to the wrong place again.', tono: 'aviso' },
      ],
    },
    {
      id: 'blacklist',
      categoria: 'usar',
      icono: ShieldBan,
      titulo: 'Blacklist',
      resumen: 'Titles and genres that must never reach your public lists.',
      pantalla: { href: '/blacklist', etiqueta: 'Open Blacklist' },
      bloques: [
        { tipo: 'p', texto: 'Anything on the [Blacklist](/blacklist) is silently dropped when it plays: no sync, no error, no entry on the trackers. It is for things you don\'t want on a public list, and for folders that aren\'t anime at all.' },
        { tipo: 'captura', src: `${CAP}/blacklist-form.webp`, alt: 'The Block Title Manually form: a title field, a reason drop-down and an Add to List button' },
        { tipo: 'lista', items: [
          '**By title** — type the name as your server shows it, pick a reason for your own reference, and click **Add to List**. The match is on the title text, so blocking `Live Action` also blocks a folder called *Live Action Films*.',
          '**By genre** — tick genres on the right and **Save excluded genres**. Anything whose tracker metadata carries one of them is skipped. **Quick Block NSFW** ticks the usual ones in one go.',
        ] },
        { tipo: 'p', texto: 'Skipped plays still show in [Sync History](/history), marked as skipped, so you can see the rule working.' },
      ],
    },
    {
      id: 'rules',
      categoria: 'ajustes',
      icono: Sliders,
      titulo: 'Sync rules',
      resumen: 'When an episode counts as watched, and what else gets synced.',
      pantalla: { href: '/settings/rules', etiqueta: 'Open Sync Rules' },
      bloques: [
        { tipo: 'captura', src: `${CAP}/rules-threshold.webp`, alt: 'The rules card: watch threshold slider, ratings toggle, auto-approve toggle and preferred tracker' },
        { tipo: 'lista', items: [
          '**Minimum watch threshold** — the percentage of an episode you have to reach before it counts. The default is **85%**, which clears the ending credits of a normal episode but not a preview you closed halfway. Lower it if you skip endings; raise it if you get accidental syncs.',
          '**Sync ratings** — when on, a score you give in the catalog is also sent to the trackers.',
          '**Auto-approve exact matches** — when a title matches a tracker entry exactly, the mapping is saved without asking. Turn it off if you want to approve every mapping yourself.',
          '**Preferred tracker** — with several linked, which one wins when they disagree about a title.',
        ] },
        { tipo: 'p', texto: 'The **simulator** next to the form shows, for a given episode length, the exact minute at which the sync would fire with your threshold. It is only illustrative; it doesn\'t send anything.' },
      ],
    },
    {
      id: 'security',
      categoria: 'ajustes',
      icono: Shield,
      titulo: 'Account security',
      resumen: 'Two-factor authentication, sessions and deleting your account.',
      pantalla: { href: '/settings/security', etiqueta: 'Open Security' },
      bloques: [
        { tipo: 'p', texto: 'Your SyncSekai account holds tokens for your tracker accounts, so it is worth protecting. Everything here is under [Security & 2FA](/settings/security).' },
        { tipo: 'captura', src: `${CAP}/security-2fa.webp`, alt: 'The two-factor authentication card with two options: an authenticator app or a code by email' },
        { tipo: 'lista', items: [
          '**Two-factor authentication** — with an authenticator app (**Set up with QR**: Google Authenticator, Authy, 1Password…) or with a code sent to your email. The app is the stronger option; email works if you don\'t want another app.',
          '**Emergency recovery codes** — generate them once 2FA is on and keep them somewhere safe. They are the way back in if you lose the phone.',
          '**Active sessions** — every device signed in to your account. **Close other sessions** signs out everything except the one you are using.',
        ] },
        { tipo: 'p', texto: '**Deleting your account** takes two confirmations — your password and an email link — and then a **24-hour grace period** during which you can cancel by signing in. After that, connections, tokens, history and mappings are removed and cannot be recovered.' },
      ],
    },
  ],

  es: [
    {
      id: 'quickstart',
      categoria: 'inicio',
      icono: Sparkles,
      titulo: 'Primeros pasos',
      resumen: 'Qué hace SyncSekai y las tres cosas que hay que configurar.',
      pantalla: { href: '/connections', etiqueta: 'Abrir Conexiones' },
      bloques: [
        { tipo: 'p', texto: 'SyncSekai mira lo que reproduces en tu servidor multimedia —**Plex**, **Jellyfin** o **Emby**— y actualiza tus listas de anime en **AniList**, **MyAnimeList** y **Kitsu** para que no tengas que hacerlo tú. Cuando terminas un episodio, el tracker pasa al siguiente. Esa es toda la idea.' },
        { tipo: 'p', texto: 'Lo demás de esta guía es detalle. Para empezar a sincronizar hacen falta exactamente tres cosas, todas en la página de [Conexiones](/connections):' },
        { tipo: 'pasos', items: [
          'Vincula al menos un **tracker**: AniList, MyAnimeList o Kitsu. Ahí va tu progreso.',
          'Vincula tu **servidor multimedia**: Plex, Jellyfin o Emby. De ahí sale el progreso.',
          'Ve algo. La primera sincronización aparece en el [Historial](/history) a los pocos segundos de terminar un episodio.',
        ] },
        { tipo: 'nota', texto: 'Puedes tener varios trackers vinculados a la vez. Todos reciben la misma actualización.' },
        { tipo: 'p', texto: 'Si un título no cuadra —una temporada partida, una OVA metida en la serie principal, dos series con el mismo nombre— para eso está el [Mapeo de títulos](/mappings). La mayoría de bibliotecas no lo necesitan nunca; las que sí, lo necesitan para un puñado de títulos.' },
      ],
    },
    {
      id: 'trackers',
      categoria: 'conectar',
      icono: Link2,
      titulo: 'Vincular un tracker',
      resumen: 'AniList, MyAnimeList y Kitsu. Donde acaba tu progreso.',
      pantalla: { href: '/connections', etiqueta: 'Abrir Conexiones' },
      bloques: [
        { tipo: 'p', texto: 'Entra en [Conexiones](/connections) y baja hasta **Cuentas de anime vinculadas**. Cada tracker tiene su propia tarjeta.' },
        { tipo: 'captura', src: `${CAP}/trackers.webp`, alt: 'Las tres tarjetas de tracker: AniList, MyAnimeList y Kitsu, con botones de desconectar y re-autenticar', pie: 'Con los tres vinculados. Una tarjeta sin vincular enseña un botón de vincular.' },
        { tipo: 'p', texto: '**AniList** y **MyAnimeList** usan OAuth: pulsa **Vincular**, autoriza a SyncSekai en su web y vuelves solo. SyncSekai nunca ve tu contraseña de esas cuentas, y puedes revocar el acceso desde los ajustes del propio tracker cuando quieras.' },
        { tipo: 'p', texto: '**Kitsu** es distinto. Su API sólo ofrece inicio de sesión con contraseña, así que la tarjeta pide tu correo y contraseña de Kitsu. Se cambian por un token y **la contraseña no se guarda**. Si ese trato no te convence, sáltate Kitsu.' },
        { tipo: 'lista', items: [
          '**Re-autenticar**: úsalo si un tracker empieza a fallar después de haber funcionado. Los tokens caducan; esto consigue uno nuevo sin perder nada.',
          '**Desconectar**: borra el token. Tu lista en el tracker no se toca.',
        ] },
        { tipo: 'nota', texto: 'Los trackers se caen. Cuando uno no responde, las sincronizaciones hacia él fallan y quedan como fallos en el Historial: es el tracker, no tu configuración. Volverán a funcionar cuando vuelva.', tono: 'aviso' },
      ],
    },
    {
      id: 'plex',
      categoria: 'conectar',
      icono: Tv,
      titulo: 'Plex',
      resumen: 'Vincula el servidor y elige bibliotecas. El webhook es opcional.',
      pantalla: { href: '/connections', etiqueta: 'Abrir Conexiones' },
      bloques: [
        { tipo: 'p', texto: 'Con el servidor vinculado, SyncSekai le pregunta cada pocos segundos qué se está reproduciendo. No hace falta más: **ni Plex Pass, ni instalar nada**. Dos pasos.' },
        { tipo: 'pasos', items: [
          'En [Conexiones](/connections), pulsa **Vincular servidor** en la tarjeta de Plex. Se abre una ventana en plex.tv: autoriza y elige tu servidor de la lista. Si no aparece, puedes escribir su URL y token a mano.',
          'En **Bibliotecas de Plex a vigilar**, marca las que contienen anime y pulsa **Guardar selección**. Sólo se sincroniza lo que reproduzcas en esas bibliotecas; una película en otra se ignora.',
        ] },
        { tipo: 'nota', texto: 'El único requisito: SyncSekai tiene que poder llegar a tu servidor por la URL que vinculaste. Un servidor que sólo se ve dentro de tu red de casa no funciona con la instancia alojada; usa el webhook de abajo, o autoaloja.', tono: 'aviso' },
        { tipo: 'p', texto: 'Para comprobar que funciona, reproduce un episodio y mira el [Historial](/history). La entrada aparece cuando el episodio pasa tu umbral de visualización (85% por defecto; ver [Reglas](/settings/rules)).' },
        { tipo: 'p', texto: '**Opcional: el webhook.** Si tienes **Plex Pass**, Plex puede además avisar a SyncSekai en el momento. Es instantáneo en vez de con unos segundos de retraso, y funciona aunque tu servidor no sea alcanzable desde internet, porque la conexión sale de Plex hacia fuera. Copia **Tu URL privada de webhook** y, en Plex Web, ve a **Ajustes → Webhooks**, pulsa **Añadir webhook**, pégala y guarda.' },
        { tipo: 'captura', src: `${CAP}/plex-webhook.webp`, alt: 'El cuadro con la URL privada del webhook en la tarjeta de Plex, con un botón de copiar', pie: 'La URL es única de tu cuenta. Trátala como una contraseña.' },
        { tipo: 'nota', texto: 'Pueden estar los dos activos a la vez. Si el webhook y el vigía de sesiones informan del mismo episodio, sólo sale una sincronización.' },
      ],
    },
    {
      id: 'jellyfin',
      categoria: 'conectar',
      icono: Tv,
      titulo: 'Jellyfin',
      resumen: 'Vincula con una clave de API e instala el plugin Webhook.',
      pantalla: { href: '/connections', etiqueta: 'Abrir Conexiones' },
      bloques: [
        { tipo: 'pasos', items: [
          'En Jellyfin, crea una clave de API: **Panel → Claves de API → +**. El nombre da igual.',
          'En [Conexiones](/connections), pulsa **Vincular servidor Jellyfin**, escribe la URL de tu servidor y la clave, y guarda. SyncSekai lee tus bibliotecas; marca las de anime y **Guardar selección**.',
          'Instala el plugin **Webhook** en Jellyfin (**Panel → Plugins → Catálogo**), reinicia Jellyfin, abre el plugin y pulsa **Add Generic Destination**.',
          'Pega la URL de webhook de la tarjeta de Jellyfin como destino, marca los tipos **Playback Progress** y **Playback Stop**, marca tu usuario y pega la plantilla de abajo en el campo **Template**. Guarda.',
        ] },
        { tipo: 'captura', src: `${CAP}/jellyfin-webhook.webp`, alt: 'El cuadro con la URL privada del webhook en la tarjeta de Jellyfin', pie: 'La misma idea que en Plex: una URL por cuenta.' },
        { tipo: 'codigo', id: 'jellyfin-template', etiqueta: 'Plantilla del webhook', texto: PLANTILLA_JELLYFIN },
        { tipo: 'nota', texto: 'Todos los campos de la plantilla van entre comillas, también los numéricos. Es a propósito: si el plugin resuelve una variable a nada, un campo entre comillas llega vacío y se ignora, mientras que uno sin comillas deja el JSON entero inválido.' },
        { tipo: 'p', texto: 'Jellyfin no manda un porcentaje de progreso por sí mismo; SyncSekai lo calcula con **PlaybackPositionTicks** y **RunTimeTicks**, por eso están los dos en la plantilla.' },
      ],
    },
    {
      id: 'emby',
      categoria: 'conectar',
      icono: Tv,
      titulo: 'Emby',
      resumen: 'Vincula con una clave de API. Sin plugin.',
      pantalla: { href: '/connections', etiqueta: 'Abrir Conexiones' },
      bloques: [
        { tipo: 'p', texto: 'Emby es el más sencillo de los tres. SyncSekai consulta las sesiones activas de tu servidor cada pocos segundos, así que no hay nada que instalar en Emby.' },
        { tipo: 'pasos', items: [
          'En Emby, crea una clave de API: **Ajustes → Avanzado → Claves de API → Nueva clave**.',
          'En [Conexiones](/connections), pulsa **Vincular servidor Emby**, escribe la URL del servidor y la clave, guarda y elige las bibliotecas a vigilar.',
        ] },
        { tipo: 'captura', src: `${CAP}/emby-card.webp`, alt: 'La tarjeta de Emby antes de vincular, con el botón de vincular servidor' },
        { tipo: 'p', texto: 'Emby también tiene webhooks nativos, pero requieren **Emby Premiere**. Si lo tienes, la tarjeta enseña una URL de webhook que puedes pegar ahí con la plantilla de abajo. Si no, ignóralo: el vigía de sesiones sincroniza igual.' },
        { tipo: 'codigo', id: 'emby-template', etiqueta: 'Plantilla del webhook (sólo Premiere)', texto: PLANTILLA_EMBY },
        { tipo: 'nota', texto: 'La plantilla de webhook de Emby no se ha comprobado contra un servidor con Premiere. La conexión directa sí. Si pruebas el webhook y hace algo raro, cuéntalo.', tono: 'aviso' },
      ],
    },
    {
      id: 'catalog',
      categoria: 'usar',
      icono: Layers,
      titulo: 'Catálogo',
      resumen: 'Tus listas, traídas en vivo de los trackers.',
      pantalla: { href: '/catalog', etiqueta: 'Abrir Catálogo' },
      bloques: [
        { tipo: 'p', texto: 'El [Catálogo](/catalog) enseña tu lista de anime tal como la ve el tracker ahora mismo: se pide en vivo, no se guarda. Elige el tracker con las píldoras de la derecha; **Local** enseña lo que ha registrado SyncSekai por su cuenta, que sirve cuando un tracker está caído.' },
        { tipo: 'captura', src: `${CAP}/catalog-filters.webp`, alt: 'La cabecera del catálogo: pestañas de estado a la izquierda, píldoras de tracker, buscador y cambio de vista a la derecha' },
        { tipo: 'lista', items: [
          'Las pestañas filtran por estado: **Viendo**, **Completado**, **Planeado**, **Pausado / Abandonado**, **Favoritos**.',
          'El botón junto al buscador cambia entre cuadrícula de portadas y lista compacta.',
          'Abre un título para ver sus episodios. Desde ahí puedes marcar progreso directamente, sin ir al tracker.',
        ] },
        { tipo: 'nota', texto: 'Como es en vivo, el catálogo va tan rápido como el tracker. Si sale vacío, mira el estado del tracker en Conexiones antes de dar por hecho que el problema es tuyo.' },
      ],
    },
    {
      id: 'history',
      categoria: 'usar',
      icono: History,
      titulo: 'Historial',
      resumen: 'Cada sincronización, qué dijo cada tracker y cómo deshacer una.',
      pantalla: { href: '/history', etiqueta: 'Abrir Historial' },
      bloques: [
        { tipo: 'p', texto: 'El [Historial](/history) es el registro de todo lo que ha hecho SyncSekai. Cuando algo se ve mal en un tracker, es el primer sitio donde mirar.' },
        { tipo: 'captura', src: `${CAP}/history-rows.webp`, alt: 'Filas del historial con el episodio, la fecha, el porcentaje visto y una insignia por tracker', pie: 'Una fila por episodio. Las insignias de la derecha son una por tracker.' },
        { tipo: 'p', texto: 'Cada fila enseña el episodio, cuándo se vio, el porcentaje visto y una insignia por cada tracker vinculado:' },
        { tipo: 'lista', items: [
          '**Tic verde**: el tracker aceptó la actualización.',
          '**Aspa roja**: la rechazó o no respondió. Pasa el ratón para ver el motivo.',
          '**Gris**: omitida, normalmente porque el título está en la lista negra o el episodio ya se había sincronizado.',
        ] },
        { tipo: 'p', texto: 'La pestaña **Errores** enseña sólo las filas con al menos un fallo. El icono de la papelera **revierte** una sincronización: borra la fila y retrocede un episodio en el tracker, que es como se arregla un scrobble accidental.' },
        { tipo: 'p', texto: 'El calendario de la derecha es tu ritmo de visionado por día, y los números de arriba se cuentan de este mismo historial: ahí no hay nada estimado.' },
      ],
    },
    {
      id: 'mappings',
      categoria: 'usar',
      icono: GitMerge,
      titulo: 'Mapeo de títulos',
      resumen: 'Cuando el nombre de la serie en tu servidor y en el tracker no coinciden.',
      pantalla: { href: '/mappings', etiqueta: 'Abrir Mapeo de títulos' },
      bloques: [
        { tipo: 'p', texto: 'SyncSekai empareja los títulos solo, y para la mayoría de series ahí se acaba. Los casos que necesitan ayuda son siempre los mismos: una segunda temporada que el servidor guarda como **Temporada 2** pero el tracker lista como entrada aparte, una OVA dentro de la temporada principal, un título que comparten dos series distintas, o un nombre en otro idioma.' },
        { tipo: 'p', texto: 'Un **mapeo** es la respuesta: "este título y temporada de mi servidor es esta entrada del tracker". Una vez guardado, todos los episodios futuros lo usan.' },
        { tipo: 'captura', src: `${CAP}/mappings-row.webp`, alt: 'Filas de mapeo, una vinculada y otra pendiente de aprobar con un botón de aprobar', pie: 'Una fila pendiente es una suposición de la que SyncSekai no está seguro. Apruébala o edítala.' },
        { tipo: 'lista', items: [
          'Las filas **Vinculadas** están confirmadas. Las **Pendientes** son suposiciones automáticas por debajo del umbral de confianza: revísalas y pulsa **Aprobar**, o **Editar** para apuntarlas a otro sitio.',
          '**Nuevo mapeo** crea uno a mano: escribe el título tal como lo enseña tu servidor, la temporada, y busca en el tracker la entrada correcta.',
          '**Hacer global** comparte un mapeo con todos los usuarios de esta instancia. Sólo pueden hacerlo los administradores; los globales salen en la pestaña **Global**.',
          '**Importar** y **Exportar** mueven tus mapeos como fichero, para que una biblioteca reconstruida no empiece de cero.',
        ] },
        { tipo: 'nota', texto: 'Si una serie se sincronizó a la entrada equivocada, arregla primero el mapeo y después revierte las filas erróneas en el Historial. Al revés, el siguiente episodio volvería a ir al sitio equivocado.', tono: 'aviso' },
      ],
    },
    {
      id: 'blacklist',
      categoria: 'usar',
      icono: ShieldBan,
      titulo: 'Lista negra',
      resumen: 'Títulos y géneros que nunca deben llegar a tus listas públicas.',
      pantalla: { href: '/blacklist', etiqueta: 'Abrir Lista negra' },
      bloques: [
        { tipo: 'p', texto: 'Lo que está en la [Lista negra](/blacklist) se descarta en silencio al reproducirse: ni sincronización, ni error, ni entrada en los trackers. Es para lo que no quieres en una lista pública, y para carpetas que no son anime.' },
        { tipo: 'captura', src: `${CAP}/blacklist-form.webp`, alt: 'El formulario de bloquear título: un campo de título, un desplegable de motivo y un botón de añadir' },
        { tipo: 'lista', items: [
          '**Por título**: escribe el nombre tal como lo enseña tu servidor, elige un motivo para tu propia referencia y pulsa **Añadir a la lista**. La coincidencia es por el texto del título, así que bloquear `Live Action` bloquea también una carpeta llamada *Live Action Films*.',
          '**Por género**: marca géneros a la derecha y **Guardar géneros excluidos**. Todo lo que en los metadatos del tracker lleve uno de ellos se omite. **Bloqueo rápido NSFW** marca los habituales de una vez.',
        ] },
        { tipo: 'p', texto: 'Las reproducciones omitidas siguen saliendo en el [Historial](/history), marcadas como omitidas, para que veas la regla funcionando.' },
      ],
    },
    {
      id: 'rules',
      categoria: 'ajustes',
      icono: Sliders,
      titulo: 'Reglas de sincronización',
      resumen: 'Cuándo un episodio cuenta como visto, y qué más se sincroniza.',
      pantalla: { href: '/settings/rules', etiqueta: 'Abrir Reglas' },
      bloques: [
        { tipo: 'captura', src: `${CAP}/rules-threshold.webp`, alt: 'La tarjeta de reglas: deslizador del umbral, interruptor de puntuaciones, aprobación automática y tracker preferido' },
        { tipo: 'lista', items: [
          '**Umbral mínimo de visualización**: el porcentaje del episodio al que hay que llegar para que cuente. Por defecto es **85%**, que pasa los créditos finales de un episodio normal pero no un avance que cerraste a la mitad. Bájalo si saltas los finales; súbelo si te salen sincronizaciones accidentales.',
          '**Sincronizar puntuaciones**: activado, una nota que pongas en el catálogo se envía también a los trackers.',
          '**Aprobar mapeos exactos automáticamente**: cuando un título coincide exactamente con una entrada del tracker, el mapeo se guarda sin preguntar. Desactívalo si quieres aprobar cada mapeo tú.',
          '**Tracker preferido**: con varios vinculados, cuál manda cuando no se ponen de acuerdo sobre un título.',
        ] },
        { tipo: 'p', texto: 'El **simulador** junto al formulario enseña, para una duración de episodio dada, el minuto exacto en que saltaría la sincronización con tu umbral. Es sólo ilustrativo; no envía nada.' },
      ],
    },
    {
      id: 'security',
      categoria: 'ajustes',
      icono: Shield,
      titulo: 'Seguridad de la cuenta',
      resumen: 'Verificación en dos pasos, sesiones y eliminación de la cuenta.',
      pantalla: { href: '/settings/security', etiqueta: 'Abrir Seguridad' },
      bloques: [
        { tipo: 'p', texto: 'Tu cuenta de SyncSekai guarda tokens de tus cuentas de tracker, así que merece protegerse. Todo esto está en [Seguridad y 2FA](/settings/security).' },
        { tipo: 'captura', src: `${CAP}/security-2fa.webp`, alt: 'La tarjeta de verificación en dos pasos con dos opciones: app autenticadora o código por correo' },
        { tipo: 'lista', items: [
          '**Verificación en dos pasos**: con una app autenticadora (**Configurar con QR**: Google Authenticator, Authy, 1Password…) o con un código al correo. La app es la opción más fuerte; el correo sirve si no quieres otra app.',
          '**Códigos de recuperación**: genéralos una vez activado el 2FA y guárdalos en un sitio seguro. Son la forma de volver a entrar si pierdes el móvil.',
          '**Sesiones activas**: todos los dispositivos con sesión en tu cuenta. **Cerrar otras sesiones** cierra todo menos la que estás usando.',
        ] },
        { tipo: 'p', texto: '**Eliminar la cuenta** lleva dos confirmaciones —tu contraseña y un enlace por correo— y después un **plazo de gracia de 24 horas** durante el que puedes cancelar entrando. Pasado ese plazo se borran conexiones, tokens, historial y mapeos, y no se pueden recuperar.' },
      ],
    },
  ],
};
