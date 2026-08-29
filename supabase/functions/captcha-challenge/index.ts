// @ts-nocheck
import { createCaptchaChallengeHandler } from './handler.ts';

Deno.serve(createCaptchaChallengeHandler({ env: (name) => Deno.env.get(name) ?? '' }));
