import { type Message, votingPubSub } from '../../utils/voting-pub-sub';
import { type SocketStream } from '@fastify/websocket';
import { type FastifyRequest, type FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function pollResults(app: FastifyInstance) {
	app.get(
		'/polls/:pollId/results',
		{
			websocket: true,
		},
		(conn: SocketStream, request: FastifyRequest) => {
			// Only subscribe to messages published to channel with poll id
			const getPollParams = z.object({
				pollId: z.string().uuid(),
			});

			const { pollId } = getPollParams.parse(request.params);

			votingPubSub.subscribe(pollId, (msg: Message) => {
				conn.socket.send(JSON.stringify(msg));
			});
		},
	);
}