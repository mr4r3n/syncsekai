import type { DocumentoLegal } from '@/components/LegalDocument';

/*
 * Política de privacidad del servicio alojado en syncsekai.com.
 *
 * Mismo criterio que terms.ts: el inglés es la versión vinculante, el español
 * es traducción de cortesía, y vive aquí como documento y no como claves de
 * interfaz. Los proveedores de inicio de sesión listados son los que existen
 * en el código: Google y Discord.
 */

const ACTUALIZADO = { en: 'Last updated: September 11, 2026', es: 'Última actualización: 11 de septiembre de 2026' };

const CONTACTO_EN = [
  'Email: mailto:mr4r3n@outlook.com',
  'GitHub: https://github.com/mr4r3n',
  'Support tickets inside the Service, once signed in.',
];
const CONTACTO_ES = [
  'Correo: mailto:mr4r3n@outlook.com',
  'GitHub: https://github.com/mr4r3n',
  'Tickets de soporte dentro del Servicio, una vez iniciada la sesión.',
];

export const PRIVACY: Record<'en' | 'es', DocumentoLegal> = {
  en: {
    titulo: 'Privacy Policy',
    actualizado: ACTUALIZADO.en,
    secciones: [
      {
        titulo: 'Overview',
        bloques: [
          'This Privacy Policy explains how SyncSekai ("SyncSekai", "we", "us", or "our") collects, uses, stores, and protects information when you use the hosted SyncSekai service available at syncsekai.com.',
          'SyncSekai is an independent open-source project. The hosted service is operated by an individual project operator and is not operated by or affiliated with Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub, or any other third-party service referenced by SyncSekai.',
          'This Privacy Policy applies to the hosted SyncSekai instance at syncsekai.com. If you run your own SyncSekai instance, the operator of that instance is responsible for its data practices and should provide their own privacy information.',
        ],
      },
      {
        titulo: 'Privacy contact',
        bloques: [
          "SyncSekai does not publish the operator's residential address or other unnecessary personal identifying information on this page.",
          'For privacy, legal, account, or data-protection questions, you may contact the project operator through:',
          CONTACTO_EN,
          'The GitHub username is provided as a public project contact rather than as a substitute for any legal identity where applicable law requires additional information.',
        ],
      },
      {
        titulo: 'Information we collect',
        bloques: [
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
        ],
      },
      {
        titulo: 'How we use information',
        bloques: [
          'Information processed by SyncSekai is used only as reasonably necessary to operate and improve the hosted service, including to:',
          [
            'Create and maintain accounts',
            'Authenticate users',
            'Connect to media servers and anime trackers',
            'Perform requested synchronization',
            'Store synchronization history and mappings',
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
        titulo: 'Third-party services',
        bloques: [
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
        titulo: 'Cookies and local storage',
        bloques: [
          'SyncSekai uses a necessary authentication and session cookie to keep you signed in and protect your account. The current session cookie is configured with security attributes such as HttpOnly, Secure, and SameSite protections.',
          'The application may also use browser local storage for non-sensitive interface preferences such as theme, sidebar state, and cookie-consent preferences.',
          'SyncSekai does not use advertising cookies or cross-site behavioral advertising trackers as part of the current hosted service. If this changes, this Privacy Policy will be updated accordingly.',
        ],
      },
      {
        titulo: 'Security',
        bloques: [
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
        titulo: 'Retention and deletion',
        bloques: [
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
        titulo: 'Your privacy rights',
        bloques: [
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
        titulo: 'Children',
        bloques: [
          'SyncSekai is not directed to children. We do not knowingly collect personal information from children in violation of applicable law.',
          'SyncSekai does not require users to provide their date of birth as part of ordinary account registration.',
        ],
      },
      {
        titulo: 'International users',
        bloques: [
          'The hosted service is delivered through infrastructure and security providers that may operate in countries other than your own. As a result, information may be processed in jurisdictions different from yours.',
          'Where applicable law provides specific requirements for international transfers or privacy protections, SyncSekai will take reasonable steps to comply with those requirements.',
        ],
      },
      {
        titulo: 'Open source and self-hosted instances',
        bloques: [
          "SyncSekai's source code is open source and can be independently reviewed or self-hosted.",
          "A self-hosted installation is not controlled by the hosted SyncSekai instance. The operator of a self-hosted installation is responsible for that installation's security, privacy practices, infrastructure, and legal obligations.",
        ],
      },
      {
        titulo: 'Third-party trademarks',
        bloques: [
          'Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub, and other referenced names and trademarks belong to their respective owners. SyncSekai is an independent project and does not claim ownership of those trademarks.',
        ],
      },
      {
        titulo: 'Changes to this Privacy Policy',
        bloques: [
          'This Privacy Policy may be updated when the service, its data practices, or applicable requirements change.',
          'The "Last updated" date at the top of this page will be changed when material revisions are made.',
        ],
      },
      {
        titulo: 'Contact',
        bloques: [
          'For privacy, legal, security, or data-protection questions:',
          CONTACTO_EN,
          'This Privacy Policy is provided as general information about the hosted SyncSekai service and is not legal advice.',
        ],
      },
    ],
  },

  es: {
    titulo: 'Política de privacidad',
    actualizado: ACTUALIZADO.es,
    aviso:
      'Esta traducción se ofrece por comodidad. La versión en inglés es la que tiene valor vinculante; en caso de discrepancia, prevalece.',
    secciones: [
      {
        titulo: 'Resumen',
        bloques: [
          'Esta Política de privacidad explica cómo SyncSekai ("SyncSekai" o "nosotros") recoge, usa, almacena y protege la información cuando usas el servicio alojado de SyncSekai disponible en syncsekai.com.',
          'SyncSekai es un proyecto independiente de código abierto. El servicio alojado lo gestiona una persona a título individual y no está gestionado por Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub ni por ningún otro servicio de terceros al que SyncSekai haga referencia, ni está afiliado a ellos.',
          'Esta Política de privacidad se aplica a la instancia alojada de SyncSekai en syncsekai.com. Si gestionas tu propia instancia de SyncSekai, el operador de esa instancia es responsable de sus prácticas de datos y debe facilitar su propia información de privacidad.',
        ],
      },
      {
        titulo: 'Contacto de privacidad',
        bloques: [
          'SyncSekai no publica en esta página el domicilio del operador ni otros datos personales identificativos que no sean necesarios.',
          'Para cuestiones de privacidad, legales, de cuenta o de protección de datos, puedes contactar con el operador del proyecto a través de:',
          CONTACTO_ES,
          'El nombre de usuario de GitHub se facilita como contacto público del proyecto y no sustituye a la identidad legal allí donde la ley aplicable exija información adicional.',
        ],
      },
      {
        titulo: 'Información que recogemos',
        bloques: [
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
        ],
      },
      {
        titulo: 'Cómo usamos la información',
        bloques: [
          'La información que trata SyncSekai se usa únicamente en la medida razonablemente necesaria para operar y mejorar el servicio alojado, lo que incluye:',
          [
            'Crear y mantener las cuentas',
            'Autenticar a los usuarios',
            'Conectar con servidores multimedia y servicios de seguimiento de anime',
            'Realizar la sincronización solicitada',
            'Guardar el historial de sincronización y los mapeos',
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
        titulo: 'Servicios de terceros',
        bloques: [
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
        titulo: 'Cookies y almacenamiento local',
        bloques: [
          'SyncSekai usa una cookie de autenticación y sesión necesaria para mantener tu sesión iniciada y proteger tu cuenta. La cookie de sesión actual está configurada con atributos de seguridad como HttpOnly, Secure y SameSite.',
          'La aplicación también puede usar el almacenamiento local del navegador para preferencias de interfaz no sensibles, como el tema, el estado de la barra lateral y las preferencias de consentimiento de cookies.',
          'SyncSekai no usa cookies publicitarias ni rastreadores de publicidad conductual entre sitios como parte del servicio alojado actual. Si esto cambia, esta Política de privacidad se actualizará en consecuencia.',
        ],
      },
      {
        titulo: 'Seguridad',
        bloques: [
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
        titulo: 'Conservación y eliminación',
        bloques: [
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
        titulo: 'Tus derechos de privacidad',
        bloques: [
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
        titulo: 'Menores',
        bloques: [
          'SyncSekai no está dirigido a menores. No recogemos a sabiendas información personal de menores infringiendo la ley aplicable.',
          'SyncSekai no pide la fecha de nacimiento en el registro ordinario de una cuenta.',
        ],
      },
      {
        titulo: 'Usuarios internacionales',
        bloques: [
          'El servicio alojado se presta a través de proveedores de infraestructura y seguridad que pueden operar en países distintos del tuyo. Por tanto, la información puede tratarse en jurisdicciones diferentes de la tuya.',
          'Cuando la ley aplicable establezca requisitos específicos para las transferencias internacionales o para la protección de la privacidad, SyncSekai tomará medidas razonables para cumplirlos.',
        ],
      },
      {
        titulo: 'Código abierto e instancias autoalojadas',
        bloques: [
          'El código fuente de SyncSekai es de código abierto y puede revisarse o autoalojarse de forma independiente.',
          'Una instalación autoalojada no está controlada por la instancia alojada de SyncSekai. El operador de una instalación autoalojada es responsable de su seguridad, de sus prácticas de privacidad, de su infraestructura y de sus obligaciones legales.',
        ],
      },
      {
        titulo: 'Marcas de terceros',
        bloques: [
          'Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub y los demás nombres y marcas mencionados pertenecen a sus respectivos titulares. SyncSekai es un proyecto independiente y no reclama la propiedad de esas marcas.',
        ],
      },
      {
        titulo: 'Cambios en esta política',
        bloques: [
          'Esta Política de privacidad puede actualizarse cuando cambien el servicio, sus prácticas de datos o los requisitos aplicables.',
          'La fecha de "Última actualización" al principio de esta página se modificará cuando se hagan revisiones sustanciales.',
        ],
      },
      {
        titulo: 'Contacto',
        bloques: [
          'Para cuestiones de privacidad, legales, de seguridad o de protección de datos:',
          CONTACTO_ES,
          'Esta Política de privacidad se facilita como información general sobre el servicio alojado de SyncSekai y no constituye asesoramiento legal.',
        ],
      },
    ],
  },
};
