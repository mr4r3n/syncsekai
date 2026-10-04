import * as os from 'os';

let address: string | undefined;

/**
 * This machine's LAN address, for the webhook URLs shown to the user: the first non-internal
 * IPv4 of each interface, outside Docker's 172.x. Read once: os.networkInterfaces() is slow,
 * the answer does not change while the server runs, and the connections panel (on every page)
 * asked for it three times per request.
 */
export function lanAddress(): string {
  if (address === undefined) {
    address = '127.0.0.1';
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('172.')) {
          address = net.address;
          break;
        }
      }
    }
  }
  return address;
}
