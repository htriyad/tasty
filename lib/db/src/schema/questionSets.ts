import { pgTable, serial, text, integer, boolean, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { foldersTable } from "./folders";

export const questionSetsTable = pgTable("question_sets", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => foldersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  examType: text("exam_type"),
  totalQuestions: integer("total_questions").notNull().default(0),
  sourceUrl: text("source_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").notNull().references(() => questionSetsTable.id, { onDelete: "cascade" }),
  chorchaId: text("chorcha_id").notNull(),
  questionIndex: integer("question_index").notNull(),
  type: text("type").notNull(),
  questionText: text("question_text").notNull().default(""),
  options: jsonb("options").$type<Array<{ letter: string; text: string }>>().notNull().default([]),
  parts: jsonb("parts").$type<Array<{ key: string; label: string; text: string; solution: string | null; aiSolution: string | null }>>().notNull().default([]),
  answer: text("answer"),
  solution: text("solution"),
  stemImages: text("stem_images").array().notNull().default([]),
  aiExplanation: text("ai_explanation"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const setQuestionLinksTable = pgTable("set_question_links", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
  setId: integer("set_id").notNull().references(() => questionSetsTable.id, { onDelete: "cascade" }),
  questionIndex: integer("question_index").notNull().default(0),
  hiddenParts: text("hidden_parts").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique("uq_link").on(t.questionId, t.setId)]);

export type QuestionSet = typeof questionSetsTable.$inferSelect;
export type Question = typeof questionsTable.$inferSelect;
export type SetQuestionLink = typeof setQuestionLinksTable.$inferSelect;
