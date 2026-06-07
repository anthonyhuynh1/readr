# Session Handoff Guide

To ensure smooth transitions between coding sessions and prevent context loss, we maintain a strict documentation routine. This guarantees that the next AI agent can immediately understand the project state, architecture, and current goals.

## 🏁 Beginning of a Session
1. **Read `docs/CURRENT_STATE.md`**: This document contains the immediate next steps, known bugs, and active priorities. It acts as the "Inbox" for the session.
2. **Review `ARCHITECTURE.md` (in root)**: (If needed) Check for any project-specific rules, tech stack decisions, or design patterns.
3. **Check `docs/PROJECT_ROADMAP.md`**: (Optional) Review the long-term vision or grab a ticket from the backlog if the current state is empty.
4. **Consult `docs/DEVELOPER_GUIDE.md`**: Review the "Operations Manual" for commands on testing, adding features, or extending the database schema.

## 🛑 End of a Session
Before concluding a session, the AI agent must perform the following wrap-up tasks:
1. **Codebase Cleanup**: 
   - Run `npm run typecheck` and `npm run lint`.
   - Fix any introduced errors or warnings.
   - Remove stray `console.log` statements or commented-out code.
2. **Update `docs/CHANGELOG.md`**: 
   - Add a brief, bulleted summary of the features implemented or bugs fixed during the session under today's date.
3. **Update `docs/CURRENT_STATE.md`**: 
   - Remove completed tasks from the active priority list.
   - Document any new bugs discovered.
   - Outline clear, actionable next steps for the next session.
