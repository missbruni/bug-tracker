-- Run this AFTER schema.sql to populate initial data

-- Critical bugs
INSERT INTO bugs (id, title, tester, device, page, severity, category, description) VALUES
('CRT-01', 'Payment component fails to load (session conflict)', 'Robert', 'Pixel 8, Chrome 393px', 'Payment', 'critical', NULL, 'Payment component (OC) fails with validation error: [0].hotelName is not allowed to be empty. Does not reproduce in incognito — suggests session/storage conflict.'),
('CRT-02', 'Pay OC infinite load', 'Nistor', 'Desktop, Chrome', 'Payment', 'critical', NULL, 'Payment OC gets stuck in an infinite loading state. No consistent repro steps — occurred twice. Console shows multiple 400 Invalid instrumentation key errors and an uncaught promise error from the Trust Payments ST.js library.'),
('CRT-03', 'Price mismatch in Pay OC', 'Nistor', 'Desktop, Chrome', 'Payment', 'critical', NULL, 'Price mismatch error surfaced on the Pay OC. No repro steps or screenshot captured.'),
('CRT-04', 'Reservation not appearing in PMS', 'Bruna', 'Desktop', 'Post-booking / PMS', 'critical', NULL, 'After completing a booking end-to-end, the reservation does not appear in the PMS.'),
('CRT-05', 'SSR renders blank page until JS hydration completes', 'Ricardo', 'Any', 'All pages', 'critical', NULL, 'On slow connections, pages are completely blank until the full JS bundle downloads and hydrates. Server-rendered HTML is not displayed, negating SSR benefits. Impacts LCP, CLS, and usability on slow/hotel Wi-Fi.');

-- High severity bugs
INSERT INTO bugs (id, title, tester, device, page, severity, category, description) VALUES
('HI-01', 'Processing state gap after payment', 'Bruna', 'Desktop', 'Payment / Confirmation', 'high', 'Payment Flow', 'After clicking Pay there is no processing/loading indicator before the confirmation page appears. User might double-click.'),
('HI-02', 'Add-ons not forwarded to PMS', 'Bruna', 'Desktop', 'Upsells / PMS', 'high', 'Upsells', 'Add-ons selected during booking are not included in the reservation sent to PMS.'),
('HI-03', 'Add-on images missing', 'Bruna', 'Desktop', 'Upsells', 'high', 'Upsells', 'Add-on cards display without images.'),
('HI-04', 'Total price doesn''t include add-ons', 'Bruna', 'Desktop', 'Summary / Payment', 'high', 'Upsells', 'Total price shown on summary/payment does not reflect add-on costs.'),
('HI-05', '"Book another room" flow restarts instead of adding', 'Bruna', 'Desktop', 'Confirmation / Search', 'high', NULL, 'Clicking "Book another room" on confirmation goes back to search instead of adding a room to the existing booking.'),
('HI-06', 'Calendar pricing not shown', 'Bruna', 'Desktop', 'Search / Calendar', 'high', NULL, 'Calendar does not display per-night prices within date cells.'),
('HI-07', 'Best-price search doesn''t show results', 'Bruna', 'Desktop', 'Search', 'high', NULL, 'When using the "best price" option in search, the results page is empty.'),
('HI-08', 'Recommendations section empty', 'Bruna', 'Desktop', 'Availabilities', 'high', NULL, 'The recommendations section on the availability page renders with no content.'),
('HI-09', 'Missing guest name on confirmation', 'Bruna', 'Desktop', 'Confirmation', 'high', NULL, 'Guest name is not displayed on the booking confirmation page.'),
('HI-10', 'Incorrect currency format', 'Bruna', 'Desktop', 'Multiple', 'high', NULL, 'Currency formatting inconsistent or incorrect across pages.'),
('HI-11', 'Back navigation loses search state', 'Bruna', 'Desktop', 'Availabilities → Search', 'high', NULL, 'Pressing back from availabilities loses the search form state.'),
('HI-12', 'Multi-room drawer overlaps CTA', 'Bruna', 'Desktop', 'Availabilities (multi-room)', 'high', NULL, 'The multi-room booking drawer overlaps the Continue / Book Now button.'),
('HI-13', 'Cancellation policy not shown before payment', 'Bruna', 'Desktop', 'Summary / Payment', 'high', NULL, 'No cancellation policy information is visible before the user commits to pay.'),
('HI-14', 'Image gallery keyboard navigation broken', 'Ricardo', 'Desktop', 'Room detail', 'high', 'Accessibility', 'Unable to navigate image gallery using keyboard arrows or focus trap within the lightbox.'),
('HI-15', 'Form fields missing autocomplete attributes', 'Ricardo', 'Desktop', 'Guest details / Payment', 'high', 'Accessibility', 'Input fields lack autocomplete attributes, harming autofill and accessibility.'),
('HI-16', 'Focus not trapped inside modals', 'Ricardo', 'Desktop', 'Multiple', 'high', 'Accessibility', 'Focus can escape modal dialogs, allowing interaction with background content.'),
('HI-17', 'No skip-to-content link', 'Ricardo', 'Desktop', 'All pages', 'high', 'Accessibility', 'Missing skip-to-content link for keyboard users.'),
('HI-18', 'Colour-only status indicators', 'Ricardo', 'Desktop', 'Availabilities', 'high', 'Accessibility', 'Availability status communicated through colour alone without text or icons.'),
('HI-19', 'Calendar not keyboard-accessible', 'Ricardo', 'Desktop', 'Search / Calendar', 'high', 'Accessibility', 'Date picker cannot be operated via keyboard navigation.'),
('HI-20', 'Touch targets too small on mobile', 'Ricardo', 'Mobile', 'Multiple', 'high', 'Accessibility', 'Several interactive elements below the recommended 44×44px touch target.'),
('HI-21', 'Guest detail autofill broken on Safari', 'Nistor', 'Desktop, Safari', 'Guest details', 'high', NULL, 'Safari autofill inserts data into wrong fields on the guest detail form.'),
('HI-22', 'Modify search re-fetches unnecessarily', 'Nistor', 'Desktop, Chrome', 'Search / Availabilities', 'high', NULL, 'Modifying search parameters triggers a full re-fetch even when only minor changes are made.'),
('HI-23', 'Missing alt text on property images', 'Oliwia', 'Desktop, Firefox 2056px', 'Properties / Room detail', 'high', 'Accessibility', 'Property and room images lack descriptive alt text.'),
('HI-24', 'Dark mode: contrast failures across components', 'Robert', 'Pixel 8, Chrome 393px', 'Multiple', 'high', 'Dark Mode', 'In dark mode several components have text/background contrast below WCAG AA — buttons, rate descriptions and chip text have poor contrast.'),
('HI-25', 'Dark mode: hotel names invisible on group page', 'Robert', 'Pixel 8, Chrome 393px', 'Group Landing Page', 'high', 'Dark Mode', 'Hotel names render in grey and are unreadable against the dark mode background.'),
('HI-26', 'Dark mode: app bar colour not changing', 'Nistor', 'Desktop, Chrome', 'Multiple', 'high', 'Dark Mode', 'App bar does not update its colour scheme in dark mode.'),
('HI-27', 'Dark mode: callout text contrast', 'Robert', 'Pixel 8, Chrome 393px', 'Multiple', 'high', 'Dark Mode', 'Callout/banner message text colour conflicts with the dark background.'),
('HI-28', 'Promo code validation discrepancy (EVO vs DBM)', 'Denisa', 'iOS, Safari', 'Search', 'high', 'Promo Codes', 'WEEKEND_PROMO is valid in EVO IBE but not in DBM. EVO IBE doesn''t yet support both promo and discount code simultaneously.'),
('HI-29', 'Discount code disappears from field', 'Denisa', 'iOS, Safari', 'Search', 'high', 'Promo Codes', 'After entering both codes, clicking away causes the discount code to vanish.'),
('HI-30', 'Copy reference button broken on mobile/iframe', 'Bruna', 'Mobile / iframe', 'Confirmation', 'high', 'Copy & Reference', 'Copy button for booking reference doesn''t work in modal mobile or iframe mode. Also missing ''copied'' indicator.');

-- Low severity bugs
INSERT INTO bugs (id, title, tester, device, page, severity, category, description) VALUES
('LO-01', 'Single-result modal scrolls unnecessarily', 'Bruna', 'Desktop', 'Availabilities', 'low', NULL, 'When filtered down to 1 result, the modal still scrolls for no reason.'),
('LO-02', '''Clear filters'' should clear and apply', 'Bruna', 'Desktop', 'Availabilities', 'low', NULL, 'Clear filters currently only clears — should also re-apply the search automatically.'),
('LO-03', 'Room page could allow longer name/description', 'Bruna', 'Desktop', 'Room detail', 'low', NULL, 'Room page truncates long room names and descriptions.'),
('LO-04', 'Embedded modal may be capped too small', 'Bruna', 'Desktop', 'Availabilities (embedded)', 'low', NULL, 'The modal height in embedded/iframe mode may be unnecessarily constrained.'),
('LO-05', 'Quantity selector not centred', 'Bruna', 'Desktop', 'Add-ons', 'low', NULL, 'The quantity selector could be vertically centred within its row.'),
('LO-06', 'Icons spaced too far apart', 'Bruna', 'Desktop', 'Multiple', 'low', NULL, 'Icon spacing appears excessive on certain components.'),
('LO-07', 'Promo code field missing on summary', 'Bruna', 'Desktop', 'Summary', 'low', NULL, 'No promo code input is visible on the summary page.'),
('LO-08', 'Payment details should appear before hotel details?', 'Bruna', 'Desktop', 'Summary', 'low', NULL, 'Questionable ordering — payment details section is below hotel details.'),
('LO-09', 'Max rooms bar should be sticky', 'Bruna', 'Desktop', 'Availabilities (multi-room)', 'low', NULL, 'Max rooms indicator should stick to the top when scrolling through many added rooms.'),
('LO-10', 'Search text too small relative to prices', 'Robert', 'Pixel 8, Chrome 393px', 'Availabilities', 'low', NULL, 'Search component text significantly smaller than price figures.'),
('LO-11', 'Search button smaller than Book Now button', 'Robert', 'Pixel 8, Chrome 393px', 'Availabilities', 'low', NULL, 'Search button noticeably smaller than Book Now CTA and may fail 44px touch target.'),
('LO-12', 'Card spacing inconsistent at 393px', 'Robert', 'Pixel 8, Chrome 393px', 'Availabilities', 'low', NULL, 'Room and rate card spacing/alignment broken at 393px viewport.'),
('LO-13', 'Filter button underutilises toolbar space', 'Robert', 'Pixel 8, Chrome 393px', 'Availabilities', 'low', NULL, 'Filter button appears smaller than necessary with unused space in its row.'),
('LO-14', 'Empty basket state not handled on upsells', 'Robert', 'Pixel 8, Chrome 393px', 'Upsells / Basket', 'low', NULL, 'Removing all rooms while on upsells leaves the user stranded.'),
('LO-15', 'Redundant ''room added'' notification on redirect', 'Robert', 'Pixel 8, Chrome 393px', 'Availabilities → Upsells', 'low', NULL, 'Notification fires when room is added even though user is instantly redirected.'),
('LO-16', 'Silent redirect to upsells is disorienting', 'Robert', 'Pixel 8, Chrome 393px', 'Availabilities → Upsells', 'low', NULL, 'User is moved to add-ons with no explanation after adding a room.'),
('LO-17', 'Back-navigate button for past months has no feedback', 'Robert', 'Pixel 8, Chrome 393px', 'Calendar', 'low', NULL, 'Calendar back button visible and tappable for past months but does nothing.'),
('LO-18', 'Dates not persistent when returning to properties', 'Nistor', 'Desktop, Chrome', 'Properties', 'low', NULL, 'Selected dates are lost when navigating back to the properties page.'),
('LO-19', 'Bottom nav auto-opens on first room add', 'Denisa', 'iOS, Safari', 'Availabilities', 'low', NULL, 'Bottom navigation drawer opens automatically and notification overlaps basket UI.'),
('LO-20', 'Faint / ghost text in input fields', 'Denisa', 'iOS, Safari', 'Search', 'low', NULL, 'Input fields sometimes display faint dotted or ghosted text overlays.'),
('LO-21', 'Missing ''scroll to top'' button', 'Denisa', 'iOS, Safari', 'Properties', 'low', NULL, 'No scroll-to-top button on the properties page.'),
('LO-22', 'Footer design could be improved', 'Denisa', 'iOS, Safari', 'All', 'low', NULL, 'Footer design is weaker compared to DBM''s version.'),
('LO-23', 'Pipe character shown when email is empty', 'Oliwia', 'Desktop, Firefox 2056px', 'Confirmation', 'low', NULL, 'A stray | separator appears when no email was provided.'),
('LO-24', 'Stay search ''best price'' loading forever', 'Bruna', 'Desktop', 'Stay search', 'low', NULL, 'Best price indicator sometimes spins indefinitely.');

-- Attachments for bugs that had them
INSERT INTO attachments (bug_id, name, note) VALUES
('CRT-02', 'trust-payments-console-errors.png', 'Console errors showing invalid instrumentation key and Trust Payments ST.js testing mode'),
('HI-28', 'promo-code-short.png', 'Promo code field with short code ''Gg'' entered — field shows error state'),
('HI-28', 'promo-code-long.png', 'Promo code field with long code ''.PROMOuxuxuuxux'' entered'),
('LO-01', 'single-result-scroll.mp4', 'Video showing unnecessary scroll on single result modal'),
('LO-03', 'room-detail-mobile-truncated.png', 'Mobile room detail — description and rate name truncated with ellipsis'),
('LO-03', 'property-card-mobile-truncated.png', 'Property card on mobile — description cut off'),
('LO-09', 'booking-drawer-1-room.png', 'Booking drawer with 1 room — notification overlapping Continue button'),
('LO-09', 'booking-drawer-3-rooms.png', 'Booking drawer with 3 rooms — total cut off at bottom, need to scroll');

-- Comments
INSERT INTO comments (bug_id, text, time) VALUES
('LO-01', 'See bug 1 video', 'From original report');

-- Open questions
INSERT INTO open_questions (id, text, tester) VALUES
('Q-01', 'Should ''Book another room'' pre-fill the calendar with the same dates from the just-completed booking?', 'Oliwia'),
('Q-02', 'What should we show when best-price search returns no results, now that recommendations exist?', 'Bruna'),
('Q-03', 'Should payment details appear before hotel details on the summary page?', 'Bruna');
