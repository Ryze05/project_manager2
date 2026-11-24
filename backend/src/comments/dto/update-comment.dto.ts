import { CreateCommentDto } from './create-comment.dto.js';

/** Editing a comment means sending its new text, so `content` stays required. */
export class UpdateCommentDto extends CreateCommentDto {}
