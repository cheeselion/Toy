import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ExploreCategory,
  HorrorGenreLabel,
  MovieDatabaseProvider,
} from './server/movieProvider.ts';
import { TmdbMovieProvider, TmdbProviderError } from './server/tmdbProvider.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CATEGORIES = new Set<ExploreCategory>([
  'popular',
  'top_rated',
  'classic',
]);

const ALLOWED_GENRES = new Set<HorrorGenreLabel>([
  '心理恐怖',
  '超自然 / 鬼怪',
  '民俗恐怖',
  '宗教恐怖',
  '血腥暴力',
  '身体恐怖',
  '邪典',
  '丧尸',
  '怪物',
  '生存恐怖',
  '伪纪录片',
  'Slasher',
  '科幻恐怖',
]);

const providers: Record<string, MovieDatabaseProvider> = {
  tmdb: new TmdbMovieProvider(),
};

function getActiveProvider(sourceParam?: string): MovieDatabaseProvider {
  const key = (sourceParam || 'tmdb').trim().toLowerCase();
  return providers[key] || providers.tmdb;
}

function handleApiError(res: express.Response, err: unknown): void {
  if (err instanceof TmdbProviderError) {
    res.status(err.statusCode).json({
      ok: false,
      code: err.code,
      message: err.message,
    });
    return;
  }
  const message =
    err instanceof Error && err.message
      ? err.message
      : '电影数据库服务请求失败，请稍后重试。';
  res.status(500).json({
    ok: false,
    code: 'INTERNAL_ERROR',
    message,
  });
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Provider configuration & compliance status
  app.get('/api/movies/status', (_req, res) => {
    const provider = getActiveProvider('tmdb');
    res.json({
      ok: true,
      ...provider.getStatus(),
    });
  });

  // Search movies via official TMDB API
  app.get('/api/movies/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (!q) {
        res.status(400).json({
          ok: false,
          code: 'EMPTY_QUERY',
          message: '请输入电影名称或关键词。',
        });
        return;
      }

      const rawPage = Number(req.query.page || 1);
      const page = Number.isFinite(rawPage)
        ? Math.min(500, Math.max(1, Math.floor(rawPage)))
        : 1;
      const horrorOnly = req.query.horrorOnly === 'true';
      const source =
        typeof req.query.source === 'string' ? req.query.source : 'tmdb';

      const provider = getActiveProvider(source);
      const payload = await provider.searchMovies({
        query: q,
        page,
        horrorOnly,
      });

      res.json({ ok: true, ...payload });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Explore curated / filtered horror movies
  app.get('/api/movies/explore', async (req, res) => {
    try {
      const rawCategory =
        typeof req.query.category === 'string' ? req.query.category.trim() : 'popular';
      const category: ExploreCategory = ALLOWED_CATEGORIES.has(
        rawCategory as ExploreCategory
      )
        ? (rawCategory as ExploreCategory)
        : 'popular';

      const country =
        typeof req.query.country === 'string' && /^[A-Za-z]{2}$/.test(req.query.country.trim())
          ? req.query.country.trim().toUpperCase()
          : undefined;

      const rawYear =
        typeof req.query.year === 'string' ? req.query.year.trim() : '';
      const yearFilter =
        /^\d{4}$/.test(rawYear) || /^\d{4}s$/.test(rawYear) || rawYear === 'pre1970'
          ? rawYear
          : undefined;

      const rawGenre =
        typeof req.query.genre === 'string' ? req.query.genre.trim() : '';
      const genre = ALLOWED_GENRES.has(rawGenre as HorrorGenreLabel)
        ? (rawGenre as HorrorGenreLabel)
        : undefined;

      const rawPage = Number(req.query.page || 1);
      const page = Number.isFinite(rawPage)
        ? Math.min(500, Math.max(1, Math.floor(rawPage)))
        : 1;
      const source =
        typeof req.query.source === 'string' ? req.query.source : 'tmdb';

      const provider = getActiveProvider(source);
      const payload = await provider.exploreMovies({
        category,
        country,
        yearFilter,
        genre,
        page,
      });

      res.json({ ok: true, ...payload });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Fetch complete movie metadata by external source + ID
  app.get('/api/movies/:source/:externalId', async (req, res) => {
    try {
      const source = req.params.source?.trim().toLowerCase();
      if (!providers[source]) {
        res.status(400).json({
          ok: false,
          code: 'UNSUPPORTED_PROVIDER',
          message: '不支持的电影数据库来源。',
        });
        return;
      }

      const externalId = req.params.externalId?.trim();
      if (!externalId || !/^[a-zA-Z0-9_-]{1,32}$/.test(externalId)) {
        res.status(400).json({
          ok: false,
          code: 'INVALID_EXTERNAL_ID',
          message: '电影 ID 格式无效。',
        });
        return;
      }

      const { detail, cached } = await providers[source].getMovieDetail(externalId);
      res.json({ ok: true, cached, detail });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Horror Diary server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
