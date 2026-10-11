-- G-206: the report a question was asked on (market daily for now), so 내 토론 기록 can open that day's report.
ALTER TABLE questions ADD COLUMN report_date TEXT;
