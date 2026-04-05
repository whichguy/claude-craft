---
name: gas-cell-comments
description: |
  Create cell-level collaboration comments in Google Sheets using a hybrid
  Notes + Drive API approach. Scaffolds ready-to-use GAS code.

  **AUTOMATICALLY INVOKE** when:
  - User wants to "add comments to cells", "comment on a cell", "cell comments"
  - User asks about programmatic Sheets comments (not notes)
  - User wants threaded discussions anchored to specific cells
  - User mentions "Drive comments" + "Sheets" or "cell"

  **NOT for:** Simple cell notes (use Range.setNote() directly),
  file-level Drive comments (use Drive.Comments.insert() directly)

model: sonnet
allowed-tools: all
---

# Cell Comments for Google Sheets (Hybrid Approach)

You scaffold a hybrid comment system for Google Sheets that combines cell-level
Notes with file-level Drive API threaded comments, working around the fact that
the Google API does not support anchoring threaded comments to specific cells.

---

## Background: Why This Exists

Google Sheets has two comment systems:
1. **Notes** (`Range.setNote()`) — yellow sticky-notes on cells, fully API-supported
2. **Threaded comments** (Insert > Comment) — threaded with @mentions and resolution

The threaded comment system uses an **internal, undocumented anchor format**:
```json
{"type":"workbook-range","uid":0,"range":"INTERNAL_ID"}
```

This format is:
- **Not documented** by Google
- **Not obtainable** via any public API
- **Not computable** from cell references
- Officially closed as **"Won't Fix"** (Google Issue Tracker #292610078, Oct 2024)
- Confirmed by Google employee Steve Bazyl: *"Sheets uses its own opaque anchors"*

**Bottom line:** You cannot programmatically create threaded comments on specific
cells. This skill provides the best available workaround.

---

## Architecture: Two-Layer Hybrid

| Layer | Technology | Cell-specific? | Threaded? | Supported? |
|-------|-----------|---------------|-----------|------------|
| Visual indicator | `Range.setNote()` | Yes | No | Fully |
| Discussion thread | `Drive.Comments.insert()` | No (file-level) | Yes | Fully |

**How it works:**
1. A **cell note** shows the latest comment summary directly on the cell (yellow triangle)
2. A **Drive comment** on the file carries the full threaded discussion
3. Drive comments use a `[Sheet1!B3]` tag prefix for cell association
4. `ScriptProperties` maps cell references to Drive comment IDs for efficient lookup
5. Before creating a new comment, the system checks if a thread already exists for that cell

---

## Prerequisites

Before using this code, enable the **Drive Advanced Service** in your GAS project:

1. In the Apps Script editor: **Services** > **+** > **Drive API** > **Add**
2. Ensure `appsscript.json` includes the `drive` OAuth scope:
   ```json
   {
     "oauthScopes": [
       "https://www.googleapis.com/auth/spreadsheets",
       "https://www.googleapis.com/auth/drive"
     ]
   }
   ```

---

## Complete GAS Code: CellCommentService.gs

When the user invokes this skill, create the following file in their GAS project:

```javascript
/**
 * CellCommentService.gs
 *
 * Hybrid cell-level comments for Google Sheets.
 * Uses Notes for visual cell indicators + Drive API for threaded discussions.
 *
 * Prerequisites: Enable Drive Advanced Service in Apps Script editor.
 */

// ============================================================
// Public API
// ============================================================

/**
 * Add a comment to a cell. If a thread already exists for this cell,
 * adds a reply instead of creating a duplicate.
 *
 * @param {string} sheetName - Sheet tab name (e.g., "Sheet1")
 * @param {string} cellA1    - Cell in A1 notation (e.g., "B3")
 * @param {string} message   - Comment text
 */
function addCellComment(sheetName, cellA1, message) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var range = sheet.getRange(cellA1);
  var cellTag = _buildCellTag(sheetName, cellA1);
  var author = Session.getActiveUser().getEmail();

  // Check for existing thread on this cell
  var existing = _findExistingComment(cellTag);
  if (existing) {
    // Thread exists — add reply instead of duplicate
    var fileId = ss.getId();
    Drive.Replies.insert(
      { content: message },
      fileId,
      existing.commentId
    );

    // Update the note with latest message
    var replies = Drive.Comments.get(fileId, existing.commentId, { includeDeleted: false });
    var replyCount = (replies.replies || []).length;
    range.setNote(_formatNote(author, message, replyCount, 'Open'));
    return { action: 'replied', commentId: existing.commentId };
  }

  // No existing thread — create new Drive comment + cell note
  var fileId = ss.getId();
  var driveComment = Drive.Comments.insert(
    { content: cellTag + ' ' + message },
    fileId
  );

  // Store the mapping for future lookups
  var props = PropertiesService.getScriptProperties();
  props.setProperty(_propKey(sheetName, cellA1), driveComment.commentId);

  // Set the cell note as visual indicator
  range.setNote(_formatNote(author, message, 0, 'Open'));

  return { action: 'created', commentId: driveComment.commentId };
}

/**
 * Reply to an existing cell discussion.
 *
 * @param {string} sheetName - Sheet tab name
 * @param {string} cellA1    - Cell in A1 notation
 * @param {string} message   - Reply text
 */
function replyCellComment(sheetName, cellA1, message) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var commentId = _getCommentId(sheetName, cellA1);
  if (!commentId) throw new Error('No comment thread found for ' + sheetName + '!' + cellA1);

  var fileId = ss.getId();
  var author = Session.getActiveUser().getEmail();

  Drive.Replies.insert(
    { content: message },
    fileId,
    commentId
  );

  // Update note with latest reply info
  var comment = Drive.Comments.get(fileId, commentId, { includeDeleted: false });
  var replyCount = (comment.replies || []).length;
  sheet.getRange(cellA1).setNote(_formatNote(author, message, replyCount, 'Open'));

  return { commentId: commentId, replyCount: replyCount };
}

/**
 * Get all comments for a cell (full thread).
 *
 * @param {string} sheetName - Sheet tab name
 * @param {string} cellA1    - Cell in A1 notation
 * @returns {Object|null} Thread data or null if no thread exists
 */
function getCellComments(sheetName, cellA1) {
  var commentId = _getCommentId(sheetName, cellA1);
  if (!commentId) return null;

  var fileId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var comment = Drive.Comments.get(fileId, commentId, { includeDeleted: false });

  return {
    commentId: commentId,
    cell: sheetName + '!' + cellA1,
    content: comment.content,
    author: comment.author.displayName,
    status: comment.status,
    replies: (comment.replies || []).map(function(r) {
      return {
        content: r.content,
        author: r.author.displayName,
        createdDate: r.createdDate
      };
    })
  };
}

/**
 * Resolve a cell discussion (mark as resolved + update note).
 *
 * @param {string} sheetName - Sheet tab name
 * @param {string} cellA1    - Cell in A1 notation
 */
function resolveCellComment(sheetName, cellA1) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var commentId = _getCommentId(sheetName, cellA1);
  if (!commentId) throw new Error('No comment thread found for ' + sheetName + '!' + cellA1);

  var fileId = ss.getId();
  Drive.Comments.patch(
    { status: 'resolved' },
    fileId,
    commentId
  );

  // Update note to show resolved status
  var comment = Drive.Comments.get(fileId, commentId, { includeDeleted: false });
  var replyCount = (comment.replies || []).length;
  var lastAuthor = Session.getActiveUser().getEmail();
  sheet.getRange(cellA1).setNote(_formatNote(lastAuthor, 'Resolved', replyCount, 'Resolved'));

  return { commentId: commentId, status: 'resolved' };
}

/**
 * List all cells with open discussion threads.
 *
 * @returns {Array} List of {sheetName, cellA1, commentId, replyCount}
 */
function listOpenDiscussions() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var fileId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var prefix = 'comment_';
  var results = [];

  for (var key in all) {
    if (key.indexOf(prefix) !== 0) continue;

    var commentId = all[key];
    try {
      var comment = Drive.Comments.get(fileId, commentId, { includeDeleted: false });
      if (comment.status === 'open') {
        var parts = key.substring(prefix.length).split('_');
        results.push({
          sheetName: parts[0],
          cellA1: parts.slice(1).join('_'),
          commentId: commentId,
          content: comment.content,
          replyCount: (comment.replies || []).length
        });
      }
    } catch (e) {
      // Comment may have been deleted externally — skip
    }
  }

  return results;
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Build the cell tag prefix used in Drive comments for filtering.
 * @param {string} sheetName
 * @param {string} cellA1
 * @returns {string} e.g., "[Sheet1!B3]"
 */
function _buildCellTag(sheetName, cellA1) {
  return '[' + sheetName + '!' + cellA1 + ']';
}

/**
 * Build the ScriptProperties key for a cell's comment ID.
 * @param {string} sheetName
 * @param {string} cellA1
 * @returns {string} e.g., "comment_Sheet1_B3"
 */
function _propKey(sheetName, cellA1) {
  return 'comment_' + sheetName + '_' + cellA1;
}

/**
 * Get the stored Drive comment ID for a cell, or null.
 * @param {string} sheetName
 * @param {string} cellA1
 * @returns {string|null}
 */
function _getCommentId(sheetName, cellA1) {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty(_propKey(sheetName, cellA1));
}

/**
 * Find an existing Drive comment for a cell by checking ScriptProperties
 * first, then falling back to scanning Drive comments for the cell tag.
 *
 * @param {string} cellTag - e.g., "[Sheet1!B3]"
 * @returns {Object|null} {commentId} or null
 */
function _findExistingComment(cellTag) {
  // Extract sheetName and cellA1 from tag
  var inner = cellTag.slice(1, -1); // "Sheet1!B3"
  var parts = inner.split('!');
  var sheetName = parts[0];
  var cellA1 = parts[1];

  // Fast path: check ScriptProperties
  var stored = _getCommentId(sheetName, cellA1);
  if (stored) {
    // Verify the comment still exists and is open
    try {
      var fileId = SpreadsheetApp.getActiveSpreadsheet().getId();
      var comment = Drive.Comments.get(fileId, stored, { includeDeleted: false });
      if (comment.status === 'open') {
        return { commentId: stored };
      }
    } catch (e) {
      // Stored comment was deleted — clear stale reference
      PropertiesService.getScriptProperties().deleteProperty(_propKey(sheetName, cellA1));
    }
  }

  // Slow path: scan Drive comments for the cell tag
  var fileId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var comments = Drive.Comments.list(fileId, { maxResults: 100, includeDeleted: false });
  var items = comments.items || [];

  for (var i = 0; i < items.length; i++) {
    if (items[i].content && items[i].content.indexOf(cellTag) === 0 && items[i].status === 'open') {
      // Found it — cache for future lookups
      PropertiesService.getScriptProperties().setProperty(_propKey(sheetName, cellA1), items[i].commentId);
      return { commentId: items[i].commentId };
    }
  }

  return null;
}

/**
 * Format the cell note text showing latest comment state.
 *
 * @param {string} author     - Email of last commenter
 * @param {string} message    - Latest message text
 * @param {number} replyCount - Number of replies
 * @param {string} status     - "Open" or "Resolved"
 * @returns {string}
 */
function _formatNote(author, message, replyCount, status) {
  var shortAuthor = author.split('@')[0];
  var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d');
  var preview = message.length > 60 ? message.substring(0, 57) + '...' : message;

  var note = '@' + shortAuthor + ' (' + date + '): ' + preview;
  if (replyCount > 0 || status === 'Resolved') {
    note += '\n[Thread: ' + replyCount + ' replies - ' + status + ']';
  }
  return note;
}
```

---

## Usage Examples

```javascript
// Add a comment to cell B3 on Sheet1
addCellComment('Sheet1', 'B3', 'This value looks incorrect — should be > 100');

// Reply to the existing thread on B3
replyCellComment('Sheet1', 'B3', 'Fixed — updated formula to include Q4 data');

// Get the full discussion thread for B3
var thread = getCellComments('Sheet1', 'B3');
Logger.log(thread);
// → {commentId: "...", cell: "Sheet1!B3", content: "...", replies: [...]}

// Resolve the discussion
resolveCellComment('Sheet1', 'B3');

// List all open discussions across the sheet
var open = listOpenDiscussions();
Logger.log(open.length + ' open discussions');
```

---

## Limitations

| Feature | Native Sheets Comments | This Hybrid Approach |
|---------|----------------------|---------------------|
| Visual cell indicator | Yellow triangle + comment bubble | Yellow triangle (note) |
| Threaded replies | Yes (inline) | Yes (Drive comment panel) |
| @mentions | Yes (inline) | Yes (Drive comments support @) |
| Resolve/reopen | Yes (inline) | Yes (via `resolveCellComment`) |
| Click cell to see thread | Yes | No — thread is in Drive comment panel |
| Programmatic creation | **Not possible** | Yes |
| Cell-to-thread linkage | Native | Convention-based (`[Sheet1!B3]` tag) |
| Works across sheets | Yes | Yes |
| ScriptProperties quota | N/A | 500KB total (sufficient for ~5000 cells) |

**Key trade-off:** Users see the note on the cell but must open the Drive comment panel
(Comments button or Ctrl+Alt+M) to view the full threaded discussion. The note shows
the latest message as a preview.
