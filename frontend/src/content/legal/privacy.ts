import type { LegalDocumentData } from '@/components/LegalDocument';
import { updatedLabel } from './updated';

/*
 * Privacy policy for service hosted on syncsekai.com.
 *
 * Same rationale as terms.ts: English is binding version, Spanish is courtesy
 * translation, residing here as a document rather than UI keys.
 * Listed authentication providers match code implementation: Google and Discord.
 */

/** Date of the last material change; also the page's lastmod in the sitemap. */
export const PRIVACY_UPDATED_ON = '2026-10-02';
const UPDATED = updatedLabel(PRIVACY_UPDATED_ON);

const CONTACT_EN = [
  'Email: mailto:mr4r3n@outlook.com',
  'GitHub: https://github.com/mr4r3n',
  'Support tickets inside the Service, once signed in.',
];
const CONTACT_ES = [
  'Correo: mailto:mr4r3n@outlook.com',
  'GitHub: https://github.com/mr4r3n',
  'Tickets de soporte dentro del Servicio, una vez iniciada la sesión.',
];

export const PRIVACY: Record<'en' | 'es', LegalDocumentData> = {
  en: {
    title: 'Privacy Policy',
    updated: UPDATED.en,
    sections: [
      {
        title: 'Overview',
        blocks: [
          'This Privacy Policy explains how SyncSekai ("SyncSekai", "we", "us", or "our") collects, uses, stores, and protects information when you use the hosted SyncSekai service available at syncsekai.com.',
          'SyncSekai is an independent open-source project. The hosted service is operated by an individual project operator and is not operated by or affiliated with Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub, or any other third-party service referenced by SyncSekai.',
          'This Privacy Policy applies to the hosted SyncSekai instance at syncsekai.com. If you run your own SyncSekai instance, the operator of that instance is responsible for its data practices and should provide their own privacy information.',
        ],
      },
      {
        title: 'Privacy contact',
        blocks: [
          "SyncSekai does not publish the operator's residential address or other unnecessary personal identifying information on this page.",
          'For privacy, legal, account, or data-protection questions, you may contact the project operator through:',
          CONTACT_EN,
          'The GitHub username is provided as a public project contact rather than as a substitute for any legal identity where applicable law requires additional information.',
        ],
      },
      {
        title: 'Information we collect',
        blocks: [
          'Depending on how you use SyncSekai, the hosted service may process the following information.',
          'Account information:',
          [
            'Username',
            'Email address',
            'Password hash',
            'Account status and activation information',
            'Two-factor authentication information, when enabled',
            'Password-reset and account-deletion tokens',
            'Account preferences and settings',
          ],
          'Third-party sign-in information. If you choose to sign in using a supported third-party provider, SyncSekai may store the provider identifier and basic account information needed to authenticate you. Supported providers are Google and Discord.',
          'Media-server connections. If you connect Plex, Jellyfin, or Emby, SyncSekai may process:',
          [
            'Server name and connection information',
            'Media-server username',
            'Authentication and API tokens required to access the connected server',
            'Selected or monitored libraries',
            'Connection and synchronization status',
            'Information necessary to identify watched media and synchronize it',
          ],
          'Authentication and API tokens are encrypted at rest. SyncSekai does not host or store copies of your video files as part of its synchronization service.',
          'Anime-tracker connections. If you connect AniList, MyAnimeList, or Kitsu, SyncSekai may process:',
          [
            'Tracker username and/or user identifier',
            'Account and avatar information made available by the provider',
            'OAuth access and refresh tokens where applicable',
            'Other authentication information required to perform synchronization',
          ],
          'Tracker credentials and tokens are handled according to the implementation of the connected provider. SyncSekai does not retain your Kitsu password after the authentication flow.',
          'Watch and synchronization information. SyncSekai may store information needed to perform and troubleshoot synchronization, including:',
          [
            'Show or anime title',
            'Season and episode',
            'Watch percentage',
            'Ratings, when synchronization of ratings is enabled',
            'Tracker and media-server identifiers',
            'Synchronization status and errors',
            'Mapping information between media-server titles and tracker titles',
            'Timestamps',
            'Server and library information',
            'A payload snapshot when needed by the synchronization or history system',
          ],
          'This information is a core part of the SyncSekai service.',
          'Sessions and security information. SyncSekai may process session identifiers, IP address, user agent, browser, operating system and device information, session activity timestamps, and security and audit information. This information may be used to authenticate users, protect accounts, detect abuse, and maintain service security.',
          'Support information. If you contact SyncSekai support, the service may store the ticket subject and messages, information you provide in the ticket, attachments you intentionally submit, and technical information associated with the request.',
          'Technical and operational information. The hosted service may process technical information such as IP addresses, application logs, reverse-proxy and security logs, error information, and aggregated operational metrics needed to run and protect the service.',
          'Visit counting. To know how many people use the site, SyncSekai counts each visitor once a day without storing their IP address and without placing any cookie: a daily identifier is derived from the IP address and browser (or, if you are signed in, from your account) with a key that is deleted the next day, so visits cannot be linked from one day to another. For each visit it keeps the approximate country and city and the network provider derived from the IP address, the browser and operating system, and, if you are signed in, your username. Visit records are deleted after one year.',
          'Account activity visible to administrators. To operate, support and protect the service, administrators can see for each account when it was last active, whether it is using the site right now and on which device, and the episodes it has synced recently.',
          'Activity and event logs. The events your media servers send (what is played, ignored or synced) are shown to administrators in a live console that is kept only in memory: they are not stored and disappear when the service restarts. Errors the site hits in your browser appear there too, with only the page and the browser. Administrative and security events, such as backups, changes to two-factor authentication and reverted synchronizations, are stored for 90 days.',
        ],
      },
      {
        title: 'How we use information',
        blocks: [
          'Information processed by SyncSekai is used only as reasonably necessary to operate and improve the hosted service, including to:',
          [
            'Create and maintain accounts',
            'Authenticate users',
            'Connect to media servers and anime trackers',
            'Perform requested synchronization',
            'Store synchronization history and mappings',
            'Improve automatic title mapping for all users with the corrections users make, as described in "Community mappings and leaderboard"',
            'Provide support',
            'Detect and prevent abuse, fraud, unauthorized access, and security incidents',
            'Maintain reliability and troubleshoot errors',
            'Communicate about account or service issues',
            'Comply with applicable legal obligations',
          ],
          'SyncSekai does not sell personal information.',
          'SyncSekai does not use your private SyncSekai account data to train general-purpose AI models.',
        ],
      },
      {
        title: 'Community mappings and leaderboard',
        blocks: [
          'When you correct a mapping by hand in the web interface (which anime a media-server title and season correspond to), that correction may be counted, together with the corrections of other users, to map the same title automatically for other users. A correction only counts when several accounts agree and none disagrees.',
          'Only the mapping itself is used: the title, the season, and the tracker identifiers and titles you chose. Your watch history, ratings, connections, and account details are not shared with other users. Mappings you import from a file are not counted.',
          'To limit abuse, only corrections from accounts that meet a minimum account age and have been used to synchronize on a minimum number of different days are counted. SyncSekai checks this with your account creation date and your synchronization history.',
          'Other users only see the resulting mapping and how many users agreed on it, never who they are. Administrators can see which accounts contributed to each agreement in order to review it, and may turn it into an official mapping for everyone or discard it.',
          'If your automatic mapping differs from one the community agreed on, SyncSekai may send you a notification with a suggestion. Nothing changes in your account unless you accept it.',
          'Leaderboard. The home page may show a leaderboard of users whose corrections helped other users. It is off by default and you only appear on it if you turn it on in your settings. When it is on, it publicly shows your username, your avatar, and the number of users you helped. You can turn it off at any time; you are removed from the leaderboard within a few minutes.',
          'If you delete your account, your corrections stop counting. Mappings already applied to other users stay in their accounts, because they contain no information about you.',
        ],
      },
      {
        title: 'Third-party services',
        blocks: [
          'SyncSekai may exchange information with third-party services when you explicitly connect or use them, or when they are required to operate the hosted service. These may include:',
          [
            'Plex',
            'Jellyfin',
            'Emby',
            'AniList',
            'MyAnimeList',
            'Kitsu',
            'Google',
            'Discord',
            'Cloudflare and infrastructure or security providers used by the hosted service',
          ],
          'Those services have their own privacy policies and terms. SyncSekai does not control how third parties process information after it is sent to them.',
        ],
      },
      {
        title: 'Cookies and local storage',
        blocks: [
          'SyncSekai uses a necessary authentication and session cookie to keep you signed in and protect your account. The current session cookie is configured with security attributes such as HttpOnly, Secure, and SameSite protections.',
          'The application may also use browser local storage for non-sensitive interface preferences such as theme, sidebar state, and cookie-consent preferences.',
          'SyncSekai does not use advertising cookies or cross-site behavioral advertising trackers as part of the current hosted service. If this changes, this Privacy Policy will be updated accordingly.',
        ],
      },
      {
        title: 'Security',
        blocks: [
          'SyncSekai uses reasonable technical and organizational measures designed to protect information processed by the hosted service. These measures include, where applicable:',
          [
            'Password hashing rather than plaintext password storage',
            'AES-256-GCM encryption for stored authentication and API tokens',
            'Secure session cookies',
            'Signed and time-limited authentication and session mechanisms',
            'Short-lived, single-use OAuth state values',
            'Two-factor authentication options',
            'Least-privilege access where practical',
            'Required application secrets rather than insecure default secrets',
            'Containerized service deployment and access controls',
          ],
          'No method of storage or transmission is completely secure, and SyncSekai cannot guarantee absolute security.',
        ],
      },
      {
        title: 'Retention and deletion',
        blocks: [
          'Information is generally retained for as long as necessary to provide the requested service, maintain account functionality, resolve support issues, protect the service, or satisfy applicable legal obligations.',
          'When an account deletion request is confirmed:',
          [
            'The deletion request is subject to a 24-hour grace period.',
            'During that period, the user may cancel the scheduled deletion when the cancellation mechanism is available.',
            "After the grace period, the account and associated records are scheduled for permanent deletion through the service's deletion process.",
            'This may include media-server connections, anime-tracker connections, synchronization history, mappings, settings, sessions, notifications, support records, and other account-associated records.',
          ],
          'Some limited information may remain in backups, security logs, or records that must be retained for legal or security reasons. Such information is retained only for as long as reasonably necessary.',
        ],
      },
      {
        title: 'Your privacy rights',
        blocks: [
          'Depending on where you live and which laws apply, you may have rights concerning your personal information, including rights to:',
          [
            'Access information we hold about you',
            'Request correction of inaccurate information',
            'Request deletion',
            'Request restriction of processing',
            'Object to certain processing',
            'Request portability of certain information',
            'Withdraw consent where processing is based on consent',
          ],
          'You may exercise applicable rights by contacting SyncSekai through the project contact listed in the "Privacy contact" section.',
          'We may need enough information to verify that a request relates to the correct account.',
        ],
      },
      {
        title: 'Children',
        blocks: [
          'SyncSekai is not directed to children. We do not knowingly collect personal information from children in violation of applicable law.',
          'SyncSekai does not require users to provide their date of birth as part of ordinary account registration.',
        ],
      },
      {
        title: 'International users',
        blocks: [
          'The hosted service is delivered through infrastructure and security providers that may operate in countries other than your own. As a result, information may be processed in jurisdictions different from yours.',
          'Where applicable law provides specific requirements for international transfers or privacy protections, SyncSekai will take reasonable steps to comply with those requirements.',
        ],
      },
      {
        title: 'Open source and self-hosted instances',
        blocks: [
          "SyncSekai's source code is open source and can be independently reviewed or self-hosted.",
          "A self-hosted installation is not controlled by the hosted SyncSekai instance. The operator of a self-hosted installation is responsible for that installation's security, privacy practices, infrastructure, and legal obligations.",
        ],
      },
      {
        title: 'Third-party trademarks',
        blocks: [
          'Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub, and other referenced names and trademarks belong to their respective owners. SyncSekai is an independent project and does not claim ownership of those trademarks.',
        ],
      },
      {
        title: 'Changes to this Privacy Policy',
        blocks: [
          'This Privacy Policy may be updated when the service, its data practices, or applicable requirements change.',
          'The "Last updated" date at the top of this page will be changed when material revisions are made.',
        ],
      },
      {
        title: 'Contact',
        blocks: [
          'For privacy, legal, security, or data-protection questions:',
          CONTACT_EN,
          'This Privacy Policy is provided as general information about the hosted SyncSekai service and is not legal advice.',
        ],
      },
    ],
  },

  es: {
    title: 'Política de privacidad',
    updated: UPDATED.es,
    aviso:
      'Esta traducción se ofrece por comodidad. La versión en inglés es la que tiene valor vinculante; en caso de discrepancia, prevalece.',
    sections: [
      {
        title: 'Resumen',
        blocks: [
          'Esta Política de privacidad explica cómo SyncSekai ("SyncSekai" o "nosotros") recoge, usa, almacena y protege la información cuando usas el servicio alojado de SyncSekai disponible en syncsekai.com.',
          'SyncSekai es un proyecto independiente de código abierto. El servicio alojado lo gestiona una persona a título individual y no está gestionado por Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub ni por ningún otro servicio de terceros al que SyncSekai haga referencia, ni está afiliado a ellos.',
          'Esta Política de privacidad se aplica a la instancia alojada de SyncSekai en syncsekai.com. Si gestionas tu propia instancia de SyncSekai, el operador de esa instancia es responsable de sus prácticas de datos y debe facilitar su propia información de privacidad.',
        ],
      },
      {
        title: 'Contacto de privacidad',
        blocks: [
          'SyncSekai no publica en esta página el domicilio del operador ni otros datos personales identificativos que no sean necesarios.',
          'Para cuestiones de privacidad, legales, de cuenta o de protección de datos, puedes contactar con el operador del proyecto a través de:',
          CONTACT_ES,
          'El nombre de usuario de GitHub se facilita como contacto público del proyecto y no sustituye a la identidad legal allí donde la ley aplicable exija información adicional.',
        ],
      },
      {
        title: 'Información que recogemos',
        blocks: [
          'Según cómo uses SyncSekai, el servicio alojado puede tratar la siguiente información.',
          'Información de la cuenta:',
          [
            'Nombre de usuario',
            'Dirección de correo electrónico',
            'Hash de la contraseña',
            'Estado de la cuenta e información de activación',
            'Información de la verificación en dos pasos, cuando está activada',
            'Tokens de restablecimiento de contraseña y de eliminación de cuenta',
            'Preferencias y ajustes de la cuenta',
          ],
          'Información de inicio de sesión con terceros. Si decides iniciar sesión con un proveedor de terceros compatible, SyncSekai puede guardar el identificador del proveedor y la información básica de la cuenta necesaria para autenticarte. Los proveedores disponibles son Google y Discord.',
          'Conexiones con servidores multimedia. Si conectas Plex, Jellyfin o Emby, SyncSekai puede tratar:',
          [
            'Nombre del servidor e información de conexión',
            'Nombre de usuario en el servidor multimedia',
            'Tokens de autenticación y de API necesarios para acceder al servidor conectado',
            'Bibliotecas seleccionadas o supervisadas',
            'Estado de la conexión y de la sincronización',
            'Información necesaria para identificar el contenido visto y sincronizarlo',
          ],
          'Los tokens de autenticación y de API se guardan cifrados. SyncSekai no aloja ni guarda copias de tus archivos de vídeo como parte de su servicio de sincronización.',
          'Conexiones con servicios de seguimiento de anime. Si conectas AniList, MyAnimeList o Kitsu, SyncSekai puede tratar:',
          [
            'Nombre de usuario o identificador en el servicio',
            'Información de la cuenta y del avatar que facilite el proveedor',
            'Tokens de acceso y de refresco OAuth, cuando corresponda',
            'Otra información de autenticación necesaria para sincronizar',
          ],
          'Las credenciales y tokens de cada servicio se gestionan según la implementación del proveedor conectado. SyncSekai no conserva tu contraseña de Kitsu una vez completada la autenticación.',
          'Información de visualización y sincronización. SyncSekai puede guardar la información necesaria para sincronizar y para diagnosticar problemas, entre ella:',
          [
            'Título de la serie o del anime',
            'Temporada y episodio',
            'Porcentaje visto',
            'Puntuaciones, cuando la sincronización de puntuaciones está activada',
            'Identificadores del servicio de seguimiento y del servidor multimedia',
            'Estado y errores de la sincronización',
            'Información de mapeo entre títulos del servidor multimedia y títulos del servicio de seguimiento',
            'Marcas de tiempo',
            'Información del servidor y de la biblioteca',
            'Una instantánea de la carga útil cuando el sistema de sincronización o de historial la necesita',
          ],
          'Esta información es parte esencial del servicio de SyncSekai.',
          'Sesiones e información de seguridad. SyncSekai puede tratar identificadores de sesión, dirección IP, agente de usuario, información del navegador, del sistema operativo y del dispositivo, marcas de tiempo de actividad de la sesión e información de seguridad y auditoría. Esta información puede usarse para autenticar a los usuarios, proteger las cuentas, detectar abusos y mantener la seguridad del servicio.',
          'Información de soporte. Si contactas con el soporte de SyncSekai, el servicio puede guardar el asunto y los mensajes del ticket, la información que facilites en él, los adjuntos que envíes voluntariamente y la información técnica asociada a la solicitud.',
          'Información técnica y operativa. El servicio alojado puede tratar información técnica como direcciones IP, registros de la aplicación, registros del proxy inverso y de seguridad, información de errores y métricas operativas agregadas necesarias para operar y proteger el servicio.',
          'Recuento de visitas. Para saber cuántas personas usan la web, SyncSekai cuenta a cada visitante una vez al día sin guardar su dirección IP y sin instalar ninguna cookie: un identificador diario se obtiene de la dirección IP y el navegador (o, si has iniciado sesión, de tu cuenta) con una clave que se borra al día siguiente, así que las visitas no pueden relacionarse de un día a otro. De cada visita se guardan el país, la ciudad aproximada y el proveedor de red deducidos de la dirección IP, el navegador y el sistema operativo y, si has iniciado sesión, tu nombre de usuario. Los registros de visitas se borran al cabo de un año.',
          'Actividad de la cuenta visible para los administradores. Para operar, dar soporte y proteger el servicio, los administradores pueden ver de cada cuenta cuándo estuvo activa por última vez, si está usando la web en este momento y desde qué dispositivo, y los episodios que ha sincronizado recientemente.',
          'Registros de actividad y eventos. Los eventos que envían tus servidores multimedia (qué se reproduce, se ignora o se sincroniza) se muestran a los administradores en una consola en directo que solo se guarda en memoria: no se almacenan y desaparecen cuando el servicio se reinicia. También aparecen ahí los errores que la web encuentra en tu navegador, solo con la página y el navegador. Los eventos de administración y seguridad, como las copias de seguridad, los cambios en la verificación en dos pasos y las sincronizaciones deshechas, se guardan durante 90 días.',
        ],
      },
      {
        title: 'Cómo usamos la información',
        blocks: [
          'La información que trata SyncSekai se usa únicamente en la medida razonablemente necesaria para operar y mejorar el servicio alojado, lo que incluye:',
          [
            'Crear y mantener las cuentas',
            'Autenticar a los usuarios',
            'Conectar con servidores multimedia y servicios de seguimiento de anime',
            'Realizar la sincronización solicitada',
            'Guardar el historial de sincronización y los mapeos',
            'Mejorar el mapeo automático de títulos para todos los usuarios con las correcciones que hacen los usuarios, como se explica en "Mapeos de la comunidad y clasificación"',
            'Prestar soporte',
            'Detectar y prevenir abusos, fraudes, accesos no autorizados e incidentes de seguridad',
            'Mantener la fiabilidad y diagnosticar errores',
            'Comunicar incidencias de la cuenta o del servicio',
            'Cumplir las obligaciones legales aplicables',
          ],
          'SyncSekai no vende información personal.',
          'SyncSekai no usa los datos privados de tu cuenta para entrenar modelos de IA de propósito general.',
        ],
      },
      {
        title: 'Mapeos de la comunidad y clasificación',
        blocks: [
          'Cuando corriges a mano un mapeo en la web (a qué anime corresponden un título y una temporada de tu servidor multimedia), esa corrección puede contarse, junto con las de otros usuarios, para mapear el mismo título automáticamente a otros usuarios. Una corrección solo cuenta cuando varias cuentas coinciden y ninguna discrepa.',
          'Solo se usa el mapeo en sí: el título, la temporada y los identificadores y títulos del servicio de seguimiento que elegiste. Tu historial de visualización, tus puntuaciones, tus conexiones y los datos de tu cuenta no se comparten con otros usuarios. Los mapeos que importas desde un archivo no cuentan.',
          'Para limitar abusos, solo cuentan las correcciones de cuentas con una antigüedad mínima y que se hayan usado para sincronizar un número mínimo de días distintos. SyncSekai lo comprueba con la fecha de creación de tu cuenta y tu historial de sincronización.',
          'Los demás usuarios solo ven el mapeo resultante y cuántos usuarios coincidieron, nunca quiénes son. Los administradores pueden ver qué cuentas participaron en cada acuerdo para revisarlo, y pueden convertirlo en un mapeo oficial para todos o descartarlo.',
          'Si tu mapeo automático no coincide con uno acordado por la comunidad, SyncSekai puede enviarte una notificación con una sugerencia. No cambia nada en tu cuenta a menos que la aceptes.',
          'Clasificación. La página principal puede mostrar una clasificación de los usuarios cuyas correcciones han ayudado a otros. Está desactivada por defecto y solo apareces si la activas en tus ajustes. Mientras está activada, muestra públicamente tu nombre de usuario, tu avatar y el número de usuarios a los que ayudaste. Puedes desactivarla cuando quieras; desapareces de la clasificación en unos minutos.',
          'Si eliminas tu cuenta, tus correcciones dejan de contar. Los mapeos que ya se aplicaron a otros usuarios siguen en sus cuentas, porque no contienen información sobre ti.',
        ],
      },
      {
        title: 'Servicios de terceros',
        blocks: [
          'SyncSekai puede intercambiar información con servicios de terceros cuando los conectas o los usas expresamente, o cuando son necesarios para operar el servicio alojado. Entre ellos pueden estar:',
          [
            'Plex',
            'Jellyfin',
            'Emby',
            'AniList',
            'MyAnimeList',
            'Kitsu',
            'Google',
            'Discord',
            'Cloudflare y los proveedores de infraestructura o seguridad que usa el servicio alojado',
          ],
          'Esos servicios tienen sus propias políticas de privacidad y condiciones. SyncSekai no controla cómo tratan la información los terceros una vez que se les ha enviado.',
        ],
      },
      {
        title: 'Cookies y almacenamiento local',
        blocks: [
          'SyncSekai usa una cookie de autenticación y sesión necesaria para mantener tu sesión iniciada y proteger tu cuenta. La cookie de sesión actual está configurada con atributos de seguridad como HttpOnly, Secure y SameSite.',
          'La aplicación también puede usar el almacenamiento local del navegador para preferencias de interfaz no sensibles, como el tema, el estado de la barra lateral y las preferencias de consentimiento de cookies.',
          'SyncSekai no usa cookies publicitarias ni rastreadores de publicidad conductual entre sitios como parte del servicio alojado actual. Si esto cambia, esta Política de privacidad se actualizará en consecuencia.',
        ],
      },
      {
        title: 'Seguridad',
        blocks: [
          'SyncSekai aplica medidas técnicas y organizativas razonables destinadas a proteger la información que trata el servicio alojado. Entre ellas, cuando corresponde:',
          [
            'Hash de contraseñas en lugar de almacenarlas en claro',
            'Cifrado AES-256-GCM de los tokens de autenticación y de API guardados',
            'Cookies de sesión seguras',
            'Mecanismos de autenticación y sesión firmados y con caducidad',
            'Valores de estado OAuth de corta duración y un solo uso',
            'Opciones de verificación en dos pasos',
            'Acceso con el mínimo privilegio cuando es viable',
            'Secretos de la aplicación obligatorios, sin valores por defecto inseguros',
            'Despliegue del servicio en contenedores y controles de acceso',
          ],
          'Ningún método de almacenamiento o transmisión es completamente seguro, y SyncSekai no puede garantizar una seguridad absoluta.',
        ],
      },
      {
        title: 'Conservación y eliminación',
        blocks: [
          'En general, la información se conserva mientras sea necesaria para prestar el servicio solicitado, mantener la funcionalidad de la cuenta, resolver incidencias de soporte, proteger el servicio o cumplir las obligaciones legales aplicables.',
          'Una vez confirmada una solicitud de eliminación de cuenta:',
          [
            'La solicitud queda sujeta a un plazo de gracia de 24 horas.',
            'Durante ese plazo, el usuario puede cancelar la eliminación programada mediante el mecanismo de cancelación disponible.',
            'Pasado el plazo, la cuenta y los registros asociados quedan programados para su eliminación definitiva a través del proceso de eliminación del servicio.',
            'Esto puede incluir las conexiones con servidores multimedia, las conexiones con servicios de seguimiento de anime, el historial de sincronización, los mapeos, los ajustes, las sesiones, las notificaciones, los registros de soporte y demás registros asociados a la cuenta.',
          ],
          'Cierta información limitada puede permanecer en copias de seguridad, registros de seguridad o registros que deban conservarse por motivos legales o de seguridad. Esa información se conserva sólo durante el tiempo razonablemente necesario.',
        ],
      },
      {
        title: 'Tus derechos de privacidad',
        blocks: [
          'Según dónde vivas y qué legislación te sea aplicable, puedes tener derechos sobre tu información personal, entre ellos el derecho a:',
          [
            'Acceder a la información que tenemos sobre ti',
            'Solicitar la corrección de información inexacta',
            'Solicitar la eliminación',
            'Solicitar la limitación del tratamiento',
            'Oponerte a determinados tratamientos',
            'Solicitar la portabilidad de determinada información',
            'Retirar el consentimiento cuando el tratamiento se base en él',
          ],
          'Puedes ejercer los derechos que te correspondan contactando con SyncSekai a través del contacto del proyecto indicado en el apartado "Contacto de privacidad".',
          'Es posible que necesitemos información suficiente para verificar que la solicitud corresponde a la cuenta correcta.',
        ],
      },
      {
        title: 'Menores',
        blocks: [
          'SyncSekai no está dirigido a menores. No recogemos a sabiendas información personal de menores infringiendo la ley aplicable.',
          'SyncSekai no pide la fecha de nacimiento en el registro ordinario de una cuenta.',
        ],
      },
      {
        title: 'Usuarios internacionales',
        blocks: [
          'El servicio alojado se presta a través de proveedores de infraestructura y seguridad que pueden operar en países distintos del tuyo. Por tanto, la información puede tratarse en jurisdicciones diferentes de la tuya.',
          'Cuando la ley aplicable establezca requisitos específicos para las transferencias internacionales o para la protección de la privacidad, SyncSekai tomará medidas razonables para cumplirlos.',
        ],
      },
      {
        title: 'Código abierto e instancias autoalojadas',
        blocks: [
          'El código fuente de SyncSekai es de código abierto y puede revisarse o autoalojarse de forma independiente.',
          'Una instalación autoalojada no está controlada por la instancia alojada de SyncSekai. El operador de una instalación autoalojada es responsable de su seguridad, de sus prácticas de privacidad, de su infraestructura y de sus obligaciones legales.',
        ],
      },
      {
        title: 'Marcas de terceros',
        blocks: [
          'Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub y los demás nombres y marcas mencionados pertenecen a sus respectivos titulares. SyncSekai es un proyecto independiente y no reclama la propiedad de esas marcas.',
        ],
      },
      {
        title: 'Cambios en esta política',
        blocks: [
          'Esta Política de privacidad puede actualizarse cuando cambien el servicio, sus prácticas de datos o los requisitos aplicables.',
          'La fecha de "Última actualización" al principio de esta página se modificará cuando se hagan revisiones sustanciales.',
        ],
      },
      {
        title: 'Contacto',
        blocks: [
          'Para cuestiones de privacidad, legales, de seguridad o de protección de datos:',
          CONTACT_ES,
          'Esta Política de privacidad se facilita como información general sobre el servicio alojado de SyncSekai y no constituye asesoramiento legal.',
        ],
      },
    ],
  },
};
