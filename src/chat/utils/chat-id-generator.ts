
import { generateRandomBase36Suffix } from "../../core/calculations/random-base36-suffix";
import {
  MESSAGE_ID_PREFIX,
  CHAT_MESSAGE_ID_SUFFIX_LENGTH,
} from "../../core/constants/identifier.constants";

const ID_PART_DELIMITER = "-";

export class ChatIdGenerator {
  private counter = 0;
  private readonly randomLength: number;

  constructor(randomLength: number = CHAT_MESSAGE_ID_SUFFIX_LENGTH) {
    this.randomLength = randomLength;
  }

  next(sender: string): string {
    this.counter += 1;
    const random = generateRandomBase36Suffix(this.randomLength);
    return [
      MESSAGE_ID_PREFIX,
      Date.now(),
      sender,
      this.counter,
      random,
    ].join(ID_PART_DELIMITER);
  }
}

export const chatIdGenerator = new ChatIdGenerator();
