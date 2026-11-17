// Adresse de la base : DATABASE_URL, ou variables copiées depuis Vercel / Prisma (préfixées)
const test = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl } = require('../progress/store');

const P = 'postgres://u:p@pooled.db.prisma.io:5432/postgres?sslmode=require';
const D = 'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require';

test('DATABASE_URL est prioritaire', () => {
    assert.deepEqual(databaseUrl({ DATABASE_URL: D, LCARTAA_DATABASE_URL_POOLED: P }), { name: 'DATABASE_URL', url: D });
});

test('variables Vercel / Prisma préfixées : la connexion pooled d\'abord, guillemets retirés', () => {
    const env = { LCARTAA_DATABASE_URL: `"${D}"`, LCARTAA_DATABASE_URL_POOLED: `"${P}"`, LCARTAA_POSTGRES_URL: D, LCARTAA_PRISMA_DATABASE_URL: D };
    assert.deepEqual(databaseUrl(env), { name: 'LCARTAA_DATABASE_URL_POOLED', url: P });
    assert.deepEqual(databaseUrl({ LCARTAA_POSTGRES_URL: D }), { name: 'LCARTAA_POSTGRES_URL', url: D });
});

test('rien de valable : pas de base (fichier local)', () => {
    assert.equal(databaseUrl({}), null);
    assert.equal(databaseUrl({ DATABASE_URL: '', OTHER_DATABASE_URL: 'mysql://x' }), null);
});
