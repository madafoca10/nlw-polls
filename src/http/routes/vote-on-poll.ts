import { randomUUID } from 'node:crypto';

import { votingPubSub } from '../../utils/voting-pub-sub';
import { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';

export async function voteOnPoll(app: FastifyInstance) {
	app.post('/polls/:pollId/votes', async (request, reply) => {
		const voteOnPollBody = z.object({
			pollOptionId: z.string().uuid(),
		});

		const voteOnPollParams = z.object({
			pollId: z.string().uuid(),
		});

		const { pollOptionId } = voteOnPollBody.parse(request.body);
		const { pollId } = voteOnPollParams.parse(request.params);

		let { sessionId } = request.cookies;

		if (sessionId) {
			const userAlreadyVotedOnPoll = await prisma.vote.findUnique({
				where: {
					sessionId_pollId: {
						pollId,
						sessionId,
					},
				},
			});

			if (
				userAlreadyVotedOnPoll &&
				userAlreadyVotedOnPoll.pollOptionId !== pollOptionId
			) {
				await prisma.vote.delete({
					where: {
						id: userAlreadyVotedOnPoll.id,
					},
				});

				const votes = await redis.zincrby(
					pollId,
					-1,
					userAlreadyVotedOnPoll.pollOptionId,
				);

				votingPubSub.publish(pollId, {
					pollOptionId: userAlreadyVotedOnPoll.pollOptionId,
					votes: Number(votes),
				});
			} else if (userAlreadyVotedOnPoll) {
				return reply.status(400).send({
					time: new Date().toISOString(),
					message: 'You already voted on this poll',
					route: request.routerPath,
				});
			}
		}

		if (!sessionId) {
			sessionId = randomUUID();

			reply.setCookie('sessionId', sessionId, {
				path: '/',
				maxAge: 60 * 60 * 24 * 30, // 30 days
				signed: true,
				httpOnly: true,
			});
		}

		await prisma.vote.create({
			data: {
				sessionId,
				pollId,
				pollOptionId,
			},
		});

		const votes = await redis.zincrby(pollId, 1, pollOptionId);

		votingPubSub.publish(pollId, {
			pollOptionId,
			votes: Number(votes),
		});

		return reply.status(201).send();
	});
}