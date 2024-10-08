// https://github.com/oott123/sklanding/blob/master/src/utils/sign.ts
import md5 from 'js-md5';
import { PROXY_SERVER } from './env';

function buf2hex(buffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function sign(path, token) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const platform = '3';
  const dId = navigator.userAgent;
  const vName = '1.0.0';

  const headers = {
    dId,
    platform,
    timestamp,
    vName,
  };
  if (!token) {
    return headers;
  }

  const signPayload = `${path.replace(
    /\?/,
    '',
  )}${timestamp}{"platform":"${platform}","timestamp":"${timestamp}","dId":${JSON.stringify(
    dId,
  )},"vName":"${vName}"}`;

  const utf8encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    utf8encoder.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign'],
  );
  const intPayload = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    utf8encoder.encode(signPayload),
  );

  const res = md5(buf2hex(intPayload));

  return {
    ...headers,
    Sign: res,
  };
}

class SklandError extends Error {
  /**
   * @param {string} message
   * @param {number} code
   */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export async function fetchSkland(path, cred, token, body) {
  const res = await fetch(`https://zonai.skland.com${path}`, {
    ...(body
      ? {
          body: JSON.stringify(body),
          method: 'POST',
        }
      : {}),
    headers: {
      Cred: cred,
      ...(await sign(path, token)),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const data = await res.json();

  if (data.code === 0) {
    return data.data;
  } else {
    throw new SklandError(data.message, data.code);
  }
}

async function fetchSklandOAuthCode(token) {
  if (!PROXY_SERVER) throw new Error('No proxy server.');

  const res = await fetch(`${PROXY_SERVER}/as.hypergryph.com/user/oauth2/v2/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();

  if (data.status === 0) {
    return data.data;
  } else {
    throw new SklandError(data.msg, data.status);
  }
}

/**
 * @param {string} token
 * @returns {{ cred: string, token: string }}
 */
export async function sklandOAuthLogin(token) {
  const { code } = await fetchSklandOAuthCode(token);

  return await fetchSkland('/api/v1/user/auth/generate_cred_by_code', undefined, undefined, {
    code,
    kind: 1,
  });
}

/**
 * @param {SklandError} err
 */
export function isNotLoginError(err) {
  return err.code === 10002;
}
