export type Message = {
	pollOptionId: string;
	votes: number;
};

type Subscriber = (message: Message) => void;

interface IVotingPubSub {
	subscribe(pollId: string, subscriber: Subscriber): void;
	publish(pollId: string, message: Message): void;
}

export class VotingPubSub implements IVotingPubSub {
	#channels: Record<string, Subscriber[]> = {};

	subscribe(pollId: string, subscriber: Subscriber): void {
		if (!this.#channels[pollId]) {
			this.#channels[pollId] = [];
		}

		this.#channels[pollId]!.push(subscriber);
	}

	publish(pollId: string, message: Message): void {
		if (!this.#channels[pollId]) {
			return;
		}

		for (const sub of this.#channels[pollId]!) {
			sub(message);
		}
	}
}

export const votingPubSub = new VotingPubSub();