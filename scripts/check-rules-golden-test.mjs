// Golden project: a small, rule-compliant backend + frontend slice must produce ZERO errors and ZERO warnings.
// This guards the checker against false positives on idiomatic code (the per-check fixtures only prove detection).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Project, listRepoFiles, runChecks } from './check-engine.mjs';
import { CHECKS } from './rules/index.mjs';

const BACKEND = {
  'backend/src/config/env.js': "import dotenv from 'dotenv';\nimport { z } from 'zod';\n\ndotenv.config();\nconst schema = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development') });\nexport const env = Object.freeze(schema.parse(process.env));\n",
  'backend/src/utils/asyncHandler.js': '/** Wraps an async Express handler and forwards rejections. */\nexport const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);\n',
  'backend/src/utils/asyncHandler.test.js': "import { it } from 'vitest';\nit('forwards errors', () => {});\n",
  'backend/src/utils/logger.js': "import pino from 'pino';\n\nexport const logger = pino({ redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'] });\n",
  'backend/src/utils/logger.test.js': "import { it } from 'vitest';\nit('redacts', () => {});\n",
  'backend/src/utils/cookies.js': "import { env } from '#config/env.js';\n\nexport function setAccessCookie(res, value) {\n  res.cookie('sai_access', value, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 900000 });\n}\n\nexport function setCsrfCookie(res, value) {\n  res.cookie('sai_csrf', value, { httpOnly: false, sameSite: 'lax', path: '/' });\n}\n",
  'backend/src/utils/cookies.test.js': "import { it } from 'vitest';\nit('sets flags', () => {});\n",
  'backend/src/modules/users/index.js': "export { default as usersRouter } from './users.routes.js';\n",
  'backend/src/modules/users/users.routes.js': "import { Router } from 'express';\nimport { authenticate } from '#middlewares/authenticate.js';\nimport { validate } from '#middlewares/validate.js';\nimport { getMe, listUsers } from './users.controller.js';\nimport { meSchema, listSchema } from './users.validation.js';\n\nconst router = Router();\n\nrouter.get('/me', authenticate, validate(meSchema), getMe);\nrouter.get('/', authenticate, validate(listSchema), listUsers);\n\nexport default router;\n",
  'backend/src/modules/users/users.routes.test.js': "import request from 'supertest';\nimport { it } from 'vitest';\nit('401 without cookie', async () => { void request; });\n",
  'backend/src/modules/users/users.controller.js': "import { asyncHandler } from '#utils/asyncHandler.js';\nimport { ok } from '#utils/apiResponse.js';\nimport * as usersService from './users.service.js';\n\nexport const getMe = asyncHandler(async (req, res) => ok(res, await usersService.getMe(req.user.id)));\nexport const listUsers = asyncHandler(async (req, res) => ok(res, await usersService.list(req.user.orgId, req.validated.query)));\n",
  'backend/src/modules/users/users.service.js': "import { User } from './user.model.js';\n\nexport async function getMe(userId) {\n  return User.findOne({ _id: userId }).lean();\n}\n\nexport async function list(orgId, { limit }) {\n  const rows = await User.find({ orgId }).limit(limit).lean();\n  return rows.map((row) => ({ id: row._id, name: row.name }));\n}\n\nexport const firstActive = (items) => items.find((item) => item.active);\n",
  'backend/src/modules/users/users.service.test.js': "import { it } from 'vitest';\nit('lists', () => {});\n",
  'backend/src/modules/users/users.validation.js': "import { z } from 'zod';\n\nexport const meSchema = z.object({});\nexport const listSchema = z.object({ query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).strict() });\n",
  'backend/src/modules/users/users.pipelines.js': "import { scopeStage } from '#db/scopeStage.js';\n\nexport const usersByRole = ({ orgId }) => [scopeStage({ orgId }), { $group: { _id: '$role', count: { $sum: 1 } } }];\n",
  'backend/src/modules/users/user.model.js': "import mongoose from 'mongoose';\n\nconst { Schema } = mongoose;\n\nconst userSchema = new Schema(\n  {\n    orgId: { type: Schema.Types.ObjectId, required: true, immutable: true },\n    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },\n    name: { type: String, required: true, trim: true, maxlength: 100 },\n    role: { type: String, enum: ['learner', 'trainer', 'admin'], default: 'learner' },\n    passwordHash: { type: String, select: false, maxlength: 72, trim: true },\n  },\n  { timestamps: true, collection: 'users' },\n);\n\nuserSchema.index({ email: 1 }, { name: 'users_email_uq', unique: true });\n\nexport const User = mongoose.model('User', userSchema);\n",
};

const FRONTEND = {
  'frontend/src/main.jsx': "import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n",
  'frontend/src/App.jsx': "import { Provider } from 'react-redux';\nimport { store } from '@/app/store';\n\nexport default function App() {\n  return <Provider store={store}>{null}</Provider>;\n}\n",
  'frontend/src/index.css': '@import "tailwindcss";\n:root { --primary: oklch(0.672 0.131 38.8); --background: #fbfaf9; }\n',
  'frontend/src/app/store.js': "import { configureStore } from '@reduxjs/toolkit';\nimport { rootReducer } from './rootReducer';\nimport { env } from '@/lib/env';\n\nexport const setupStore = (preloadedState) => configureStore({ reducer: rootReducer, preloadedState, devTools: env.isDev });\nexport const store = setupStore();\n",
  'frontend/src/app/rootReducer.js': "import { combineReducers } from '@reduxjs/toolkit';\nimport authReducer from '@/features/auth/slice/authSlice';\n\nexport const rootReducer = combineReducers({ auth: authReducer });\n",
  'frontend/src/app/hooks.js': "import { useDispatch, useSelector, useStore } from 'react-redux';\n\nexport const useAppDispatch = useDispatch;\nexport const useAppSelector = useSelector;\nexport const useAppStore = useStore;\n",
  'frontend/src/lib/env.js': "export const env = Object.freeze({ isDev: import.meta.env.DEV, apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1' });\n",
  'frontend/src/lib/logger.js': 'export const logger = { error: (ctx) => console.error(ctx) };\n',
  'frontend/src/lib/storage.js': "const KEYS = { theme: 'sai-theme' };\n\nexport function readTheme() {\n  try {\n    return localStorage.getItem(KEYS.theme) ?? 'system';\n  } catch {\n    return 'system';\n  }\n}\n",
  'frontend/src/lib/apiError.js': 'export const toApiError = (error) => ({ code: error?.code ?? "UNKNOWN", message: String(error?.message ?? "") });\n',
  'frontend/src/lib/asyncState.js': "export const asyncInitial = { status: 'idle', error: null, lastFetchedAt: null };\n",
  'frontend/src/lib/apiClient.js': "import axios from 'axios';\nimport { env } from './env';\n\nexport const apiClient = axios.create({ baseURL: env.apiUrl, withCredentials: true, timeout: 30000 });\n",
  'frontend/src/features/auth/index.js': "export { default as authReducer } from './slice/authSlice';\n",
  'frontend/src/features/auth/api/authApi.js': "import { apiClient } from '@/lib/apiClient';\n\nexport const getMe = async ({ signal }) => (await apiClient.get('/auth/me', { signal })).data;\n",
  'frontend/src/features/auth/slice/authSlice.js': "import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';\nimport { asyncInitial } from '@/lib/asyncState';\nimport { toApiError } from '@/lib/apiError';\nimport * as authApi from '../api/authApi';\n\nexport const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async (_, { signal, rejectWithValue }) => {\n  try {\n    return await authApi.getMe({ signal });\n  } catch (error) {\n    return rejectWithValue(toApiError(error));\n  }\n});\n\nconst authSlice = createSlice({\n  name: 'auth',\n  initialState: { ...asyncInitial, user: null, bootstrapped: false },\n  reducers: {\n    sessionExpired(state) {\n      state.user = null;\n    },\n  },\n  extraReducers: (builder) => {\n    builder.addCase(fetchCurrentUser.fulfilled, (state, action) => {\n      state.user = action.payload;\n    });\n  },\n});\n\nexport const { sessionExpired } = authSlice.actions;\nexport const selectUser = (state) => state.auth.user;\nexport default authSlice.reducer;\n",
  'frontend/src/features/auth/schemas/authSchemas.js': "import { z } from 'zod';\n\nexport const loginSchema = z.object({ email: z.string().trim().email('validation.email'), password: z.string().min(10, 'validation.passwordMin') });\n",
  'frontend/src/features/auth/components/LoginForm.jsx': "import { useTranslation } from 'react-i18next';\nimport { Link } from 'react-router';\nimport { useAppDispatch } from '@/app/hooks';\nimport { Button } from '@/components/ui/button';\nimport { MailIcon } from '@/components/icons';\n\nexport function LoginForm() {\n  const { t } = useTranslation('auth');\n  const dispatch = useAppDispatch();\n  const submit = async () => {\n    try {\n      await dispatch({ type: 'auth/login' });\n    } catch (error) {\n      throw new Error('login failed', { cause: error });\n    }\n  };\n  return (\n    <form onSubmit={submit} className=\"flex flex-col gap-4 rounded-lg border border-border bg-card p-6\">\n      <label htmlFor=\"email\" className=\"text-sm font-medium\">{t('login.email')}</label>\n      <input id=\"email\" type=\"email\" autoComplete=\"username\" className=\"h-10 rounded-md border border-input bg-background px-3\" />\n      <Button type=\"submit\" className=\"bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 ring-ring\">\n        <MailIcon aria-hidden className=\"size-4\" />\n        {t('login.submit')}\n      </Button>\n      <a href=\"https://example.test\" target=\"_blank\" rel=\"noopener noreferrer\">{t('login.help')}</a>\n      <Link to=\"/forgot-password\">{t('login.forgot')}</Link>\n      <img src=\"/favicon.svg\" alt={t('login.logoAlt')} width=\"32\" height=\"32\" />\n    </form>\n  );\n}\n",
  'frontend/src/features/auth/components/LoginForm.test.jsx': "import { it } from 'vitest';\nit('renders', () => {});\n",
  'frontend/src/features/auth/pages/LoginPage.jsx': "import { LoginForm } from '../components/LoginForm';\n\nexport default function LoginPage() {\n  return <LoginForm />;\n}\n",
  'frontend/src/components/icons/index.js': "export { RiMailFill as MailIcon, RiCloseFill as CloseIcon } from 'react-icons/ri';\nexport { MdKeyboardArrowDown as ChevronDownIcon } from 'react-icons/md';\n",
  'frontend/src/components/ui/button.jsx': "import { cn } from '@/lib/cn';\n\nexport function Button({ className, ...props }) {\n  return <button className={cn('inline-flex h-10 items-center rounded-md px-4 shadow-sm', className)} {...props} />;\n}\n",
  'frontend/src/lib/cn.js': "export const cn = (...parts) => parts.filter(Boolean).join(' ');\n",
  'frontend/src/i18n/index.js': "export const languages = ['en', 'hi'];\n",
  'frontend/src/i18n/locales/en/auth.json': JSON.stringify({ login: { email: 'Email', submit: 'Sign in', help: 'Help', forgot: 'Forgot password', logoAlt: 'SAMARTH AI' } }),
  'frontend/src/i18n/locales/hi/auth.json': JSON.stringify({ login: { email: 'ईमेल', submit: 'साइन इन', help: 'सहायता', forgot: 'पासवर्ड भूल गए', logoAlt: 'SAMARTH AI' } }),
  'frontend/package.json': JSON.stringify({ name: 'frontend', dependencies: { react: '^19.3.1', axios: '^1.20.0', motion: '^14.6.0', 'react-icons': '^5.7.0' } }),
  'backend/package.json': JSON.stringify({ name: 'backend', dependencies: { express: '^5.3.0', mongoose: '^9.11.3' } }),
  'package.json': JSON.stringify({ name: 'samarth-ai', private: true, scripts: { dev: 'node scripts/dev.mjs' } }),
  'backend/.env.sample': 'PORT=8000\nACCESS_TOKEN_SECRET=\nREFRESH_TOKEN_SECRET=change-me\nCORS_ALLOWED_ORIGINS=http://localhost:5173\nCLOUDINARY_API_SECRET=\n',
  'frontend/.env.sample': 'VITE_API_URL=\nVITE_GOOGLE_CLIENT_ID=\n',
};

test('a rule-compliant mini project yields no errors and no warnings', () => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'samarth-golden-')), 'repo');
  for (const [rel, content] of Object.entries({ ...BACKEND, ...FRONTEND })) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  const { violations } = runChecks(new Project(root, listRepoFiles(root)), CHECKS.filter((c) => c.id !== 'edge-pages-exist'));
  const text = violations.map((v) => `${v.severity} ${v.check} ${v.file}:${v.line} ${v.message}`).join('\n');
  assert.equal(violations.length, 0, `false positives:\n${text}`);
});
