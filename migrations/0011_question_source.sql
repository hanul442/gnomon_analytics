-- G-116: where a question was asked (the committee debate or the chat) and who answered, for 내 토론 기록.
ALTER TABLE questions ADD COLUMN source TEXT;
ALTER TABLE questions ADD COLUMN speaker TEXT;
