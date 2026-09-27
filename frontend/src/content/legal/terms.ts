import type { DocumentoLegal } from '@/components/LegalDocument';

/*
 * Condiciones del servicio alojado en syncsekai.com.
 *
 * El texto en inglés es la versión vinculante; el español es una traducción de
 * cortesía y lo dice en su aviso. Se mantiene aquí y no en los JSON de idioma
 * porque es un documento: se lee entero y se cambia entero.
 *
 * Pendientes: ley aplicable y resolución de disputas.
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

export const TERMS: Record<'en' | 'es', DocumentoLegal> = {
  en: {
    titulo: 'Terms of Service',
    actualizado: ACTUALIZADO.en,
    secciones: [
      {
        titulo: 'Acceptance of these Terms',
        bloques: [
          'These Terms of Service ("Terms") govern your access to and use of the hosted SyncSekai service available at syncsekai.com ("SyncSekai", "the Service", "we", "us", or "our").',
          'By creating an account or using the hosted Service, you agree to these Terms. If you do not agree with them, do not use the hosted Service.',
          'SyncSekai is an independent open-source project operated by an individual project operator. It is not operated by or affiliated with Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub, or any other third-party service referenced by SyncSekai.',
        ],
      },
      {
        titulo: 'Operator and contact',
        bloques: [
          "SyncSekai does not publish the operator's residential address or other unnecessary personal identifying information on this page.",
          'For service, legal, or account matters:',
          CONTACTO_EN,
          'The GitHub username is provided as a public project contact rather than as a substitute for any legal identity where applicable law requires additional information.',
        ],
      },
      {
        titulo: 'Age requirement',
        bloques: [
          'You must be legally permitted to use the Service in your jurisdiction.',
          'SyncSekai is not directed to children. If you are under the minimum age at which you may independently use an online service under the laws applicable to you, you may use SyncSekai only where permitted by applicable law and with any parental or guardian consent that may be required.',
          'SyncSekai does not require users to provide their date of birth as part of ordinary account registration.',
        ],
      },
      {
        titulo: 'The Service',
        bloques: [
          'SyncSekai is open-source software and a hosted synchronization service designed to connect supported media servers with supported anime-tracking services.',
          'Supported integrations may include:',
          ['Plex', 'Jellyfin', 'Emby', 'AniList', 'MyAnimeList', 'Kitsu'],
          'The Service may provide features such as:',
          [
            'Watch-progress synchronization',
            'Episode and season synchronization',
            'Ratings synchronization when enabled',
            'Title mapping',
            'Mapping approval and management',
            'Blacklists',
            'Synchronization history',
            'Notifications',
            'Account and connection management',
          ],
          'SyncSekai does not host or provide copies of your video or other media files as part of its synchronization service.',
        ],
      },
      {
        titulo: 'Accounts',
        bloques: [
          'You are responsible for providing accurate information when creating an account and for keeping your credentials secure.',
          'You are responsible for activity performed through your account.',
          'You may use available security features such as two-factor authentication to protect your account.',
        ],
      },
      {
        titulo: 'Connected third-party services',
        bloques: [
          'Some SyncSekai features require you to connect third-party services.',
          'When you connect a third-party service:',
          [
            'You authorize SyncSekai to access the information and functions necessary to provide the requested integration.',
            "You remain responsible for complying with the third party's terms and policies.",
            'SyncSekai does not control third-party availability, API behavior, rate limits, or policy changes.',
          ],
          'Third-party services may change or revoke access at any time, which can cause synchronization features to stop working.',
        ],
      },
      {
        titulo: 'Synchronization',
        bloques: [
          'Synchronization is performed based on the connections, permissions, settings, mappings, and preferences configured by you.',
          'SyncSekai may not always be able to synchronize information correctly because of:',
          [
            'Third-party API outages or changes',
            'Incorrect or ambiguous title mappings',
            'Incorrect media-server metadata',
            'Rate limits',
            'Network failures',
            'Expired or revoked credentials',
            'Service configuration',
            'Bugs or other technical problems',
          ],
          'You are responsible for reviewing synchronization settings and results when necessary.',
        ],
      },
      {
        titulo: 'Acceptable use',
        bloques: [
          'You agree not to use SyncSekai to:',
          [
            'Attack, disrupt, overload, or intentionally degrade the Service',
            'Circumvent authentication, encryption, access controls, or role-based restrictions',
            "Gain unauthorized access to another person's account, server, or data",
            'Introduce malware, malicious code, or harmful content into the Service',
            'Abuse third-party APIs through the Service',
            'Scrape or automate access in a manner that bypasses intended limits',
            'Resell or commercially redistribute access to the hosted Service without authorization',
            'Use the Service in violation of applicable law',
          ],
          'Nothing in these Terms grants you permission to bypass restrictions imposed by Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, or other third-party services.',
        ],
      },
      {
        titulo: 'User data and content',
        bloques: [
          'You retain rights to information and content that you provide or connect to SyncSekai, subject to the rights necessary for SyncSekai to operate the Service.',
          'You grant SyncSekai the limited permission necessary to process your information and connected-service data solely to provide the features you request, maintain the Service, provide support, protect security, and comply with applicable law.',
          'SyncSekai does not claim ownership of your media library or watch history merely because the Service processes that information.',
        ],
      },
      {
        titulo: 'Intellectual property',
        bloques: [
          'The SyncSekai source code is open source and is distributed under the license included with the project repository, currently the GNU Affero General Public License version 3 (AGPL-3.0).',
          'The open-source license governs use, modification, and redistribution of the source code. It does not automatically grant rights to third-party trademarks, services, content, or APIs.',
          'Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub, and other third-party names and trademarks belong to their respective owners.',
        ],
      },
      {
        titulo: 'Open source and self-hosting',
        bloques: [
          "SyncSekai may be self-hosted using the project's source code.",
          'The hosted service at syncsekai.com is operated separately from individual self-hosted installations.',
          'If you self-host SyncSekai, you are responsible for:',
          [
            'Your server and infrastructure',
            'Your security configuration',
            'Your users and accounts',
            'Your data-processing practices',
            'Your backups',
            'Your compliance with applicable laws and third-party terms',
          ],
          'These Terms apply to the hosted SyncSekai service and do not automatically govern independently operated self-hosted installations.',
        ],
      },
      {
        titulo: 'Security',
        bloques: [
          'SyncSekai uses reasonable security measures designed to protect the hosted Service, including encrypted storage of authentication and API tokens, password hashing, secure session handling, OAuth protections, and optional two-factor authentication.',
          'However, no online service is completely secure. You acknowledge that use of the Service carries the ordinary risks associated with internet-connected systems.',
          'You are responsible for protecting your account credentials and connected third-party accounts.',
        ],
      },
      {
        titulo: 'Availability and changes',
        bloques: [
          'SyncSekai is provided on a best-effort basis. The Service may be temporarily unavailable because of maintenance, upgrades, outages, infrastructure problems, third-party failures, security incidents, or other circumstances.',
          'Features may be modified, suspended, or discontinued as the project develops.',
        ],
      },
      {
        titulo: 'Suspension and termination',
        bloques: [
          'SyncSekai may suspend or terminate access when reasonably necessary to:',
          [
            'Protect the Service or other users',
            'Respond to abuse or security incidents',
            'Address violations of these Terms',
            'Comply with legal obligations',
            'Address prolonged inactivity or technical circumstances',
          ],
          'Where reasonably practical, users may be notified before non-emergency suspension or termination.',
        ],
      },
      {
        titulo: 'Account deletion',
        bloques: [
          'You may request deletion of your SyncSekai account using the account-deletion functionality provided by the Service.',
          'After a deletion request is confirmed:',
          [
            'A 24-hour grace period applies.',
            'During that period, the deletion may be cancelled when the available cancellation mechanism is used.',
            "After the grace period, the account is scheduled for permanent deletion through the Service's deletion process.",
          ],
          'Deletion may include your account, media-server connections, anime-tracker connections, synchronization history, mappings, settings, sessions, notifications, support records, and other account-associated records.',
          'Information retained in backups, security logs, or records that must be kept for legal or security purposes may remain for the period reasonably necessary.',
        ],
      },
      {
        titulo: 'Third-party services',
        bloques: [
          'SyncSekai integrates with services operated by third parties. Those services are independent of SyncSekai.',
          'SyncSekai is not responsible for:',
          [
            'Third-party outages',
            'Third-party API changes',
            'Third-party account restrictions',
            'Third-party data practices',
            'Third-party content',
            'Third-party terms or policies',
          ],
          "Your use of a connected third-party service remains subject to that service's own terms and policies.",
        ],
      },
      {
        titulo: 'Disclaimer of warranties',
        bloques: [
          'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE HOSTED SYNCSEKAI SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.',
          'SYNCSEKAI DOES NOT GUARANTEE THAT THE SERVICE WILL:',
          [
            'ALWAYS BE AVAILABLE',
            'BE ERROR-FREE',
            'ALWAYS SYNCHRONIZE DATA CORRECTLY',
            'REMAIN COMPATIBLE WITH EVERY THIRD-PARTY SERVICE',
            'PRESERVE DATA WITHOUT INTERRUPTION OR LOSS',
          ],
        ],
      },
      {
        titulo: 'Limitation of liability',
        bloques: [
          'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SYNCSEKAI OPERATOR WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO YOUR USE OF, OR INABILITY TO USE, THE HOSTED SERVICE.',
          'THIS INCLUDES, TO THE EXTENT PERMITTED BY LAW, LOSS OF DATA, LOSS OF ACCESS, LOSS OF PROFITS, BUSINESS INTERRUPTION, OR PROBLEMS CAUSED BY THIRD-PARTY SERVICES.',
          'NOTHING IN THESE TERMS EXCLUDES OR LIMITS LIABILITY WHERE SUCH EXCLUSION OR LIMITATION IS NOT PERMITTED BY APPLICABLE LAW.',
        ],
      },
      {
        titulo: 'Changes to these Terms',
        bloques: [
          'These Terms may be updated when the Service, its features, or applicable requirements change.',
          'The "Last updated" date at the top of this page will be updated when material revisions are made.',
          'Your continued use of the hosted Service after a material update constitutes acceptance of the revised Terms to the extent permitted by applicable law.',
        ],
      },
      {
        titulo: 'Severability',
        bloques: [
          'If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in effect to the extent permitted by law.',
        ],
      },
      {
        titulo: 'Contact',
        bloques: [
          'For service, legal, privacy, security, or account questions:',
          CONTACTO_EN,
          'These Terms are provided as general information about the hosted SyncSekai service and are not legal advice.',
        ],
      },
    ],
  },

  es: {
    titulo: 'Condiciones del servicio',
    actualizado: ACTUALIZADO.es,
    aviso:
      'Esta traducción se ofrece por comodidad. La versión en inglés es la que tiene valor vinculante; en caso de discrepancia, prevalece.',
    secciones: [
      {
        titulo: 'Aceptación de estas condiciones',
        bloques: [
          'Estas Condiciones del servicio ("Condiciones") regulan tu acceso y uso del servicio alojado de SyncSekai disponible en syncsekai.com ("SyncSekai", "el Servicio" o "nosotros").',
          'Al crear una cuenta o usar el Servicio alojado, aceptas estas Condiciones. Si no estás de acuerdo con ellas, no uses el Servicio alojado.',
          'SyncSekai es un proyecto independiente de código abierto gestionado por una persona a título individual. No está gestionado por Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub ni por ningún otro servicio de terceros al que SyncSekai haga referencia, ni está afiliado a ellos.',
        ],
      },
      {
        titulo: 'Operador y contacto',
        bloques: [
          'SyncSekai no publica en esta página el domicilio del operador ni otros datos personales identificativos que no sean necesarios.',
          'Para cuestiones sobre el servicio, legales o de cuenta:',
          CONTACTO_ES,
          'El nombre de usuario de GitHub se facilita como contacto público del proyecto y no sustituye a la identidad legal allí donde la ley aplicable exija información adicional.',
        ],
      },
      {
        titulo: 'Requisito de edad',
        bloques: [
          'Debes tener capacidad legal para usar el Servicio en tu jurisdicción.',
          'SyncSekai no está dirigido a menores. Si no alcanzas la edad mínima para usar por tu cuenta un servicio en línea según la legislación que te sea aplicable, sólo puedes usar SyncSekai donde la ley lo permita y con el consentimiento parental o del tutor que pueda ser necesario.',
          'SyncSekai no pide la fecha de nacimiento en el registro ordinario de una cuenta.',
        ],
      },
      {
        titulo: 'El Servicio',
        bloques: [
          'SyncSekai es un software de código abierto y un servicio de sincronización alojado, diseñado para conectar servidores multimedia compatibles con servicios de seguimiento de anime compatibles.',
          'Las integraciones disponibles pueden incluir:',
          ['Plex', 'Jellyfin', 'Emby', 'AniList', 'MyAnimeList', 'Kitsu'],
          'El Servicio puede ofrecer funciones como:',
          [
            'Sincronización del progreso de visualización',
            'Sincronización de episodios y temporadas',
            'Sincronización de puntuaciones, cuando está activada',
            'Mapeo de títulos',
            'Aprobación y gestión de mapeos',
            'Listas negras',
            'Historial de sincronización',
            'Notificaciones',
            'Gestión de la cuenta y de las conexiones',
          ],
          'SyncSekai no aloja ni facilita copias de tus archivos de vídeo u otros archivos multimedia como parte de su servicio de sincronización.',
        ],
      },
      {
        titulo: 'Cuentas',
        bloques: [
          'Eres responsable de facilitar información veraz al crear una cuenta y de mantener seguras tus credenciales.',
          'Eres responsable de la actividad que se realice a través de tu cuenta.',
          'Puedes usar las funciones de seguridad disponibles, como la verificación en dos pasos, para proteger tu cuenta.',
        ],
      },
      {
        titulo: 'Servicios de terceros conectados',
        bloques: [
          'Algunas funciones de SyncSekai requieren que conectes servicios de terceros.',
          'Al conectar un servicio de terceros:',
          [
            'Autorizas a SyncSekai a acceder a la información y a las funciones necesarias para ofrecer la integración solicitada.',
            'Sigues siendo responsable de cumplir las condiciones y políticas de ese tercero.',
            'SyncSekai no controla la disponibilidad, el comportamiento de la API, los límites de uso ni los cambios de política de terceros.',
          ],
          'Los servicios de terceros pueden cambiar o revocar el acceso en cualquier momento, lo que puede hacer que las funciones de sincronización dejen de funcionar.',
        ],
      },
      {
        titulo: 'Sincronización',
        bloques: [
          'La sincronización se realiza según las conexiones, permisos, ajustes, mapeos y preferencias que tú configures.',
          'Es posible que SyncSekai no siempre pueda sincronizar la información correctamente debido a:',
          [
            'Caídas o cambios en las API de terceros',
            'Mapeos de títulos incorrectos o ambiguos',
            'Metadatos incorrectos del servidor multimedia',
            'Límites de uso',
            'Fallos de red',
            'Credenciales caducadas o revocadas',
            'La configuración del Servicio',
            'Errores u otros problemas técnicos',
          ],
          'Eres responsable de revisar los ajustes y los resultados de la sincronización cuando sea necesario.',
        ],
      },
      {
        titulo: 'Uso aceptable',
        bloques: [
          'Te comprometes a no usar SyncSekai para:',
          [
            'Atacar, interrumpir, sobrecargar o degradar intencionadamente el Servicio',
            'Eludir la autenticación, el cifrado, los controles de acceso o las restricciones por rol',
            'Obtener acceso no autorizado a la cuenta, el servidor o los datos de otra persona',
            'Introducir malware, código malicioso o contenido dañino en el Servicio',
            'Abusar de las API de terceros a través del Servicio',
            'Extraer datos o automatizar el acceso de forma que se eludan los límites previstos',
            'Revender o redistribuir comercialmente el acceso al Servicio alojado sin autorización',
            'Usar el Servicio infringiendo la ley aplicable',
          ],
          'Nada en estas Condiciones te autoriza a eludir las restricciones impuestas por Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu u otros servicios de terceros.',
        ],
      },
      {
        titulo: 'Datos y contenido del usuario',
        bloques: [
          'Conservas los derechos sobre la información y el contenido que facilitas o conectas a SyncSekai, sin perjuicio de los derechos necesarios para que SyncSekai pueda operar el Servicio.',
          'Concedes a SyncSekai el permiso limitado necesario para tratar tu información y los datos de los servicios conectados con el único fin de ofrecer las funciones que solicitas, mantener el Servicio, prestar soporte, proteger la seguridad y cumplir la ley aplicable.',
          'SyncSekai no reclama la propiedad de tu biblioteca multimedia ni de tu historial de visualización por el mero hecho de que el Servicio trate esa información.',
        ],
      },
      {
        titulo: 'Propiedad intelectual',
        bloques: [
          'El código fuente de SyncSekai es de código abierto y se distribuye bajo la licencia incluida en el repositorio del proyecto, actualmente la GNU Affero General Public License versión 3 (AGPL-3.0).',
          'La licencia de código abierto regula el uso, la modificación y la redistribución del código fuente. No concede automáticamente derechos sobre marcas, servicios, contenidos o API de terceros.',
          'Plex, Jellyfin, Emby, AniList, MyAnimeList, Kitsu, Google, Discord, GitHub y los demás nombres y marcas de terceros pertenecen a sus respectivos titulares.',
        ],
      },
      {
        titulo: 'Código abierto y autoalojamiento',
        bloques: [
          'SyncSekai puede autoalojarse a partir del código fuente del proyecto.',
          'El servicio alojado en syncsekai.com se gestiona de forma independiente de las instalaciones autoalojadas.',
          'Si autoalojas SyncSekai, eres responsable de:',
          [
            'Tu servidor y tu infraestructura',
            'Tu configuración de seguridad',
            'Tus usuarios y cuentas',
            'Tus prácticas de tratamiento de datos',
            'Tus copias de seguridad',
            'Tu cumplimiento de la ley aplicable y de las condiciones de terceros',
          ],
          'Estas Condiciones se aplican al servicio alojado de SyncSekai y no rigen automáticamente las instalaciones autoalojadas gestionadas por otros.',
        ],
      },
      {
        titulo: 'Seguridad',
        bloques: [
          'SyncSekai aplica medidas de seguridad razonables destinadas a proteger el Servicio alojado, entre ellas el almacenamiento cifrado de los tokens de autenticación y de API, el hash de contraseñas, la gestión segura de sesiones, protecciones en OAuth y la verificación en dos pasos opcional.',
          'Aun así, ningún servicio en línea es completamente seguro. Reconoces que el uso del Servicio conlleva los riesgos ordinarios de cualquier sistema conectado a internet.',
          'Eres responsable de proteger las credenciales de tu cuenta y de las cuentas de terceros que conectes.',
        ],
      },
      {
        titulo: 'Disponibilidad y cambios',
        bloques: [
          'SyncSekai se presta según el mejor esfuerzo posible. El Servicio puede no estar disponible temporalmente por mantenimiento, actualizaciones, caídas, problemas de infraestructura, fallos de terceros, incidentes de seguridad u otras circunstancias.',
          'Las funciones pueden modificarse, suspenderse o retirarse a medida que el proyecto evoluciona.',
        ],
      },
      {
        titulo: 'Suspensión y cancelación',
        bloques: [
          'SyncSekai puede suspender o cancelar el acceso cuando sea razonablemente necesario para:',
          [
            'Proteger el Servicio o a otros usuarios',
            'Responder a abusos o incidentes de seguridad',
            'Atender infracciones de estas Condiciones',
            'Cumplir obligaciones legales',
            'Gestionar una inactividad prolongada o circunstancias técnicas',
          ],
          'Cuando sea razonablemente posible, se avisará a los usuarios antes de una suspensión o cancelación que no sea de emergencia.',
        ],
      },
      {
        titulo: 'Eliminación de la cuenta',
        bloques: [
          'Puedes solicitar la eliminación de tu cuenta de SyncSekai mediante la función de eliminación de cuenta que ofrece el Servicio.',
          'Una vez confirmada la solicitud de eliminación:',
          [
            'Se aplica un plazo de gracia de 24 horas.',
            'Durante ese plazo, la eliminación puede cancelarse mediante el mecanismo de cancelación disponible.',
            'Pasado el plazo, la cuenta queda programada para su eliminación definitiva a través del proceso de eliminación del Servicio.',
          ],
          'La eliminación puede incluir tu cuenta, las conexiones con servidores multimedia, las conexiones con servicios de seguimiento de anime, el historial de sincronización, los mapeos, los ajustes, las sesiones, las notificaciones, los registros de soporte y demás registros asociados a la cuenta.',
          'La información conservada en copias de seguridad, registros de seguridad o registros que deban mantenerse por motivos legales o de seguridad puede permanecer durante el tiempo razonablemente necesario.',
        ],
      },
      {
        titulo: 'Servicios de terceros',
        bloques: [
          'SyncSekai se integra con servicios gestionados por terceros. Esos servicios son independientes de SyncSekai.',
          'SyncSekai no es responsable de:',
          [
            'Las caídas de terceros',
            'Los cambios en las API de terceros',
            'Las restricciones de cuenta impuestas por terceros',
            'Las prácticas de datos de terceros',
            'El contenido de terceros',
            'Las condiciones o políticas de terceros',
          ],
          'Tu uso de un servicio de terceros conectado sigue sujeto a las condiciones y políticas de ese servicio.',
        ],
      },
      {
        titulo: 'Exclusión de garantías',
        bloques: [
          'EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY APLICABLE, EL SERVICIO ALOJADO DE SYNCSEKAI SE PRESTA "TAL CUAL" Y "SEGÚN DISPONIBILIDAD", SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS NI IMPLÍCITAS.',
          'SYNCSEKAI NO GARANTIZA QUE EL SERVICIO:',
          [
            'ESTÉ SIEMPRE DISPONIBLE',
            'ESTÉ LIBRE DE ERRORES',
            'SINCRONICE SIEMPRE LOS DATOS CORRECTAMENTE',
            'SIGA SIENDO COMPATIBLE CON TODOS LOS SERVICIOS DE TERCEROS',
            'CONSERVE LOS DATOS SIN INTERRUPCIONES NI PÉRDIDAS',
          ],
        ],
      },
      {
        titulo: 'Limitación de responsabilidad',
        bloques: [
          'EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY APLICABLE, EL OPERADOR DE SYNCSEKAI NO SERÁ RESPONSABLE DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES, EJEMPLARES NI PUNITIVOS DERIVADOS DE TU USO DEL SERVICIO ALOJADO O DE LA IMPOSIBILIDAD DE USARLO, NI RELACIONADOS CON ELLO.',
          'ESTO INCLUYE, EN LA MEDIDA PERMITIDA POR LA LEY, LA PÉRDIDA DE DATOS, LA PÉRDIDA DE ACCESO, EL LUCRO CESANTE, LA INTERRUPCIÓN DE LA ACTIVIDAD O LOS PROBLEMAS CAUSADOS POR SERVICIOS DE TERCEROS.',
          'NADA EN ESTAS CONDICIONES EXCLUYE NI LIMITA LA RESPONSABILIDAD CUANDO LA LEY APLICABLE NO PERMITA TAL EXCLUSIÓN O LIMITACIÓN.',
        ],
      },
      {
        titulo: 'Cambios en estas condiciones',
        bloques: [
          'Estas Condiciones pueden actualizarse cuando cambien el Servicio, sus funciones o los requisitos aplicables.',
          'La fecha de "Última actualización" al principio de esta página se modificará cuando se hagan revisiones sustanciales.',
          'Si sigues usando el Servicio alojado tras una actualización sustancial, se entenderá que aceptas las Condiciones revisadas, en la medida en que lo permita la ley aplicable.',
        ],
      },
      {
        titulo: 'Divisibilidad',
        bloques: [
          'Si alguna disposición de estas Condiciones resulta inválida o inaplicable, las demás seguirán en vigor en la medida en que lo permita la ley.',
        ],
      },
      {
        titulo: 'Contacto',
        bloques: [
          'Para cuestiones sobre el servicio, legales, de privacidad, de seguridad o de cuenta:',
          CONTACTO_ES,
          'Estas Condiciones se facilitan como información general sobre el servicio alojado de SyncSekai y no constituyen asesoramiento legal.',
        ],
      },
    ],
  },
};
