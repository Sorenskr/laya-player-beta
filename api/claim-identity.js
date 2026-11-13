/**
 * Laya Player 跨设备昵称/头像全局去重轻量后端 (Vercel Serverless Function)
 * 接口路径：
 *   - POST / GET /api/claim-identity?action=claim-nickname
 *   - POST / GET /api/claim-identity?action=claim-avatar
 *   - POST /api/claim-identity (支持批量同时申领未使用的昵称与头像索引)
 * 作用：
 *   记录全局已分配的昵称与头像标识，返回“全局未使用”的候选项并标记为已使用，
 *   确保电脑 A 用过的昵称/头像在电脑 B 上不再重复分配；当池子耗尽时自动轮转重置。
 */

const globalClaimedState = globalThis.__LAYA_GLOBAL_CLAIMED_STATE__ || (globalThis.__LAYA_GLOBAL_CLAIMED_STATE__ = {
    usedNicknames: new Set(),
    usedAvatars: new Set(),
    clientShardCounter: 0,
    updatedAt: Date.now()
});

const MAX_TRACKED_NICKNAMES = 280;
const MAX_TRACKED_AVATARS = 280;

function pickUnusedItems(candidates, usedSet, count, maxTracked) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const need = Math.max(1, Math.min(50, Number(count) || 1));

    if (usedSet.size >= maxTracked || usedSet.size >= Math.floor(candidates.length * 0.88)) {
        usedSet.clear();
    }

    const unused = candidates.filter(item => item && !usedSet.has(String(item)));
    const sourcePool = unused.length >= need ? unused : candidates;

    // 洗牌后选取
    const shuffled = sourcePool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
    }

    const picked = shuffled.slice(0, need);
    picked.forEach(item => usedSet.add(String(item)));
    globalClaimedState.updatedAt = Date.now();
    return picked;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const body = typeof req.body === 'string'
            ? (req.body.trim() ? JSON.parse(req.body) : {})
            : (req.body || {});
        const query = req.query || {};
        const action = String(body.action || query.action || 'claim-batch').trim();
        const clientIp = String(
            req.headers['x-forwarded-for'] ||
            req.headers['x-real-ip'] ||
            req.socket?.remoteAddress ||
            '0.0.0.0'
        ).split(',')[0].trim();

        globalClaimedState.clientShardCounter = (globalClaimedState.clientShardCounter + 1) % 100000;

        if (action === 'claim-nickname') {
            const candidates = Array.isArray(body.candidates) ? body.candidates : [];
            const count = Number(body.count || query.count || 1);
            const claimed = pickUnusedItems(candidates, globalClaimedState.usedNicknames, count, MAX_TRACKED_NICKNAMES);
            return res.status(200).json({
                ok: true,
                action: 'claim-nickname',
                claimed,
                nickname: claimed[0] || null,
                totalClaimedGlobal: globalClaimedState.usedNicknames.size,
                clientIpHash: hashString(clientIp)
            });
        }

        if (action === 'claim-avatar') {
            const candidates = Array.isArray(body.candidates) ? body.candidates : [];
            const count = Number(body.count || query.count || 1);
            const claimed = pickUnusedItems(candidates, globalClaimedState.usedAvatars, count, MAX_TRACKED_AVATARS);
            return res.status(200).json({
                ok: true,
                action: 'claim-avatar',
                claimed,
                avatarId: claimed[0] || null,
                totalClaimedGlobal: globalClaimedState.usedAvatars.size,
                clientIpHash: hashString(clientIp)
            });
        }

        // 默认支持同时申领未使用的昵称与头像 ID 列表
        const nickCandidates = Array.isArray(body.nicknames) ? body.nicknames : [];
        const avatarCandidates = Array.isArray(body.avatarIds) ? body.avatarIds : [];
        const nickCount = Number(body.nickCount || query.nickCount || 12);
        const avatarCount = Number(body.avatarCount || query.avatarCount || 16);

        const claimedNicknames = pickUnusedItems(nickCandidates, globalClaimedState.usedNicknames, nickCount, MAX_TRACKED_NICKNAMES);
        const claimedAvatarIds = pickUnusedItems(avatarCandidates, globalClaimedState.usedAvatars, avatarCount, MAX_TRACKED_AVATARS);

        return res.status(200).json({
            ok: true,
            action: 'claim-batch',
            claimedNicknames,
            claimedAvatarIds,
            shardIndex: globalClaimedState.clientShardCounter,
            clientIpHash: hashString(clientIp),
            stats: {
                usedNicknamesCount: globalClaimedState.usedNicknames.size,
                usedAvatarsCount: globalClaimedState.usedAvatars.size
            }
        });
    } catch (err) {
        return res.status(200).json({
            ok: false,
            fallback: 'device-fingerprint-shard',
            error: String(err && err.message ? err.message : err)
        });
    }
};

function hashString(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
}
