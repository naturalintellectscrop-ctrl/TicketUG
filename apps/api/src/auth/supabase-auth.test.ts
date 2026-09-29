import { describe, expect, it } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose'
import { extractRequestAccessToken, extractSupabaseAccessTokenFromCookie, supabaseStorageKey, verifyAccessTokenWithKeyStore } from './supabase-auth.js'

const STORAGE_KEY = 'sb-vmebmexwqfpnlioicqgj-auth-token'

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

describe('supabase cookie parsing (@supabase/ssr base64url contract)', () => {
  it('reads a single encoded auth cookie', () => {
    const value = 'base64-' + base64UrlJson({ access_token: 'token-abc', refresh_token: 'r' })
    const header = `other=1; ${STORAGE_KEY}=${value}; extra=2`
    expect(extractSupabaseAccessTokenFromCookie(header, STORAGE_KEY)).toBe('token-abc')
  })

  it('reads a legacy raw-JSON cookie value', () => {
    const header = `${STORAGE_KEY}=${base64UrlJson({ access_token: 'raw-token' })}`
    expect(extractSupabaseAccessTokenFromCookie(header, STORAGE_KEY)).toBe('raw-token')
  })

  it('reassembles chunked cookies in index order', () => {
    const encoded = 'base64-' + base64UrlJson({ access_token: 'chunked-token', refresh_token: 'r' })
    const middle = Math.floor(encoded.length / 2)
    const header = `${STORAGE_KEY}.0=${encoded.slice(0, middle)}; ${STORAGE_KEY}.1=${encoded.slice(middle)}`
    expect(extractSupabaseAccessTokenFromCookie(header, STORAGE_KEY)).toBe('chunked-token')
  })

  it('returns null for missing, malformed, or token-less cookies', () => {
    expect(extractSupabaseAccessTokenFromCookie('', STORAGE_KEY)).toBeNull()
    expect(extractSupabaseAccessTokenFromCookie('session=other-cookie', STORAGE_KEY)).toBeNull()
    expect(extractSupabaseAccessTokenFromCookie(`${STORAGE_KEY}=base64-!!!not-base64url!!!`, STORAGE_KEY)).toBeNull()
    const noToken = 'base64-' + base64UrlJson({ refresh_token: 'only-refresh' })
    expect(extractSupabaseAccessTokenFromCookie(`${STORAGE_KEY}=${noToken}`, STORAGE_KEY)).toBeNull()
  })
})

describe('request access-token extraction', () => {
  it('prefers the Authorization Bearer header', () => {
    const headers = { authorization: 'Bearer bearer-token', cookie: `${STORAGE_KEY}=base64-${base64UrlJson({ access_token: 'cookie-token' })}` }
    expect(extractRequestAccessToken(headers, STORAGE_KEY)).toBe('bearer-token')
  })

  it('falls back to the session cookie', () => {
    const headers = { cookie: `${STORAGE_KEY}=base64-${base64UrlJson({ access_token: 'cookie-token' })}` }
    expect(extractRequestAccessToken(headers, STORAGE_KEY)).toBe('cookie-token')
  })

  it('returns null without any credential', () => {
    expect(extractRequestAccessToken({}, STORAGE_KEY)).toBeNull()
    expect(extractRequestAccessToken({ authorization: 'Basic abc' }, STORAGE_KEY)).toBeNull()
  })
})

describe('storage key derivation', () => {
  it('matches supabase-js (first host label)', () => {
    expect(supabaseStorageKey('https://vmebmexwqfpnlioicqgj.supabase.co')).toBe('sb-vmebmexwqfpnlioicqgj-auth-token')
    expect(supabaseStorageKey('http://localhost:5998/')).toBe('sb-localhost-auth-token')
  })
})

describe('access-token verification (ES256 via JWKS)', () => {
  async function setup() {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-kid', alg: 'ES256', use: 'sig' }
    const keyStore = createLocalJWKSet({ keys: [publicJwk as never] })
    const issuer = 'https://vmebmexwqfpnlioicqgj.supabase.co/auth/v1'
    async function mint(claims: Record<string, unknown>, key = privateKey) {
      return new SignJWT({ ...claims })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-kid' })
        .sign(key)
    }
    return { keyStore, issuer, mint, otherKey: (await generateKeyPair('ES256', { extractable: true })).privateKey }
  }

  it('accepts a valid authenticated token for this project', async () => {
    const { keyStore, issuer, mint } = await setup()
    const token = await mint({ sub: 'user-1', email: 'a@b.c', iss: issuer, aud: 'authenticated' })
    const claims = await verifyAccessTokenWithKeyStore(keyStore, token, issuer)
    expect(claims?.sub).toBe('user-1')
    expect(claims?.email).toBe('a@b.c')
  })

  it('rejects forged signatures, wrong issuer, anonymous audience, and expired tokens', async () => {
    const { keyStore, issuer, mint, otherKey } = await setup()
    const forged = await mint({ sub: 'user-1', iss: issuer, aud: 'authenticated' }, otherKey)
    expect(await verifyAccessTokenWithKeyStore(keyStore, forged, issuer)).toBeNull()
    const wrongIssuer = await mint({ sub: 'user-1', iss: 'https://other.supabase.co/auth/v1', aud: 'authenticated' })
    expect(await verifyAccessTokenWithKeyStore(keyStore, wrongIssuer, issuer)).toBeNull()
    const anonymous = await mint({ sub: 'user-1', iss: issuer, aud: 'anonymous' })
    expect(await verifyAccessTokenWithKeyStore(keyStore, anonymous, issuer)).toBeNull()
    const expired = await mint({ sub: 'user-1', iss: issuer, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) - 3600 })
    expect(await verifyAccessTokenWithKeyStore(keyStore, expired, issuer)).toBeNull()
  })

  it('rejects symmetric (HS256) tokens — asymmetric keys only', async () => {
    const { keyStore, issuer } = await setup()
    const hsSecret = new TextEncoder().encode('attacker-controlled-secret-0123456789abcdef')
    // A symmetric JWT would never validate against an asymmetric JWKS; this
    // pinpoints that the verifier does not silently accept unknown algs.
    const hsToken = await new SignJWT({ sub: 'user-1', iss: issuer, aud: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(hsSecret)
      .catch(() => null)
    if (hsToken) expect(await verifyAccessTokenWithKeyStore(keyStore, hsToken, issuer)).toBeNull()
  })
})
