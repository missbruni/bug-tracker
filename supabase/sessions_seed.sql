-- Seed data for Testing Sessions feature

-- 13 Testers (devices left empty for manual configuration)
insert into testers (name) values
  ('Jigar Vadiwala'),
  ('Denisa Buftea'),
  ('Mateusz Kolasa'),
  ('Ricardo Agullo'),
  ('Ayaz Shaikh'),
  ('Darshita Bhalala'),
  ('Tomasz Siwiec'),
  ('Dayang Dai'),
  ('Oliwia Szwon'),
  ('Bojan Tasevski'),
  ('Ionut Nistor'),
  ('Bruna Lima'),
  ('Robert Ventura'),
  ('Leo Costa')
on conflict do nothing;

-- Session #2
insert into sessions (id, name, date, status) values
  ('a0000000-0000-0000-0000-000000000001', 'EVO IBE E2E Testing Session #2', current_date, 'draft')
on conflict do nothing;

-- Scenarios A–M for session #2
insert into scenarios (session_id, letter, title, description, device_requirement, sort_order) values
(
  'a0000000-0000-0000-0000-000000000001', 'A',
  'Room-by-Rate View + Sorting & Filtering',
  '1. Open the booking engine URL → select a hotel, pick dates, set 2 adults → click Search
2. On the results page, make sure the view is set to "Room by Rate" (toggle at the top)
3. Try sorting: click Price low→high, then high→low — confirm the order changes
4. Open a filter (e.g. room type or facilities) — confirm results update. Clear filters — all results return
5. Click a room card to open its detail → browse the image gallery → check facilities → pick a rate
6. Click the (i) info icon next to a rate → verify the cancellation policy and payment type labels are correct
7. Continue: Add-ons → Summary → fill in billing, type a special request, select a bed preference → Pay → Confirmation

✓ PMS: Check the reservation appeared with correct room, rate, dates, guest name, special request text, and bed preference.',
  'Desktop Chrome', 1
),
(
  'a0000000-0000-0000-0000-000000000001', 'B',
  'Rate-by-Room View + Sorting & Filtering',
  '1. Open booking engine → select hotel, dates, 2 adults → Search
2. Switch the view toggle to "Rate by Room" (rate plan cards with rooms inside)
3. Sort by price both directions — confirm order updates in this layout
4. Apply different filters from Tester A — confirm cards filter correctly
5. Pick a rate plan, expand room options, select a room, add to basket
6. Click the rate (i) info → verify cancellation timeline and prepayment label (deposit / first night / scheduled)
7. Continue through checkout: Add-ons → Summary (fill special request + bed preference) → Pay → Confirmation

✓ PMS: Confirm rate plan name, room, guest details, special request, bed preference all match.',
  'Desktop Edge', 2
),
(
  'a0000000-0000-0000-0000-000000000001', 'C',
  'Multi-Room Booking',
  '1. In the guest selector, set 2 or 3 rooms. Add children to at least one room
2. After searching, you''ll see empty basket slots for each room. The active slot is highlighted
3. Room 1: Pick a room + rate → basket shows slot 1 filled, total updates
4. Room 2: Pick a different room type → slot 2 fills
5. Try clicking a filled slot → it takes you back to that room step to change the selection
6. On Summary: verify each room section has the correct room, rate, guest details, special request, bed preference
7. Pay → Confirmation → all rooms should be listed

✓ PMS: All rooms appear in PMS with correct guest names, room types, per-room special requests and bed preferences.',
  'Desktop Firefox', 3
),
(
  'a0000000-0000-0000-0000-000000000001', 'D',
  'Add-ons + Payment Flow',
  '1. Book any room to reach the Add-ons page
2. Check: images load, descriptions visible, quantity +/- buttons work
3. Add 2+ different add-ons, increase one quantity to 2+ → basket total updates live
4. Set one add-on back to 0 → it disappears from basket
5. On Summary: verify add-ons listed with correct quantities and prices. Try submitting with empty billing fields → validation errors appear
6. Fill billing, toggle "Use billing details for guest", select a bed preference
7. Payment page: iframe loads → enter test card → if error, retry → arrive at Confirmation
8. Confirmation: check reference number, room + add-on line items, print button works

✓ PMS: Reservation has all add-ons with correct quantities. Payment status recorded.',
  'Desktop Chrome', 4
),
(
  'a0000000-0000-0000-0000-000000000001', 'E',
  'Non-Payment Flow + Recommendations',
  '1. Find a rate that does not require payment (look for "Book now, pay later" label)
2. Add to basket → Summary → there should be no payment iframe, just a "Confirm Booking" button
3. Submit → Confirmation page shows booking reference and correct total
4. Recommendations test: start a new search with 6+ adults
5. A "Recommendations" section should appear with suggested room combinations
6. Click a recommendation → rooms auto-fill the basket slots → complete the booking

✓ PMS: Non-payment reservation reached PMS. Recommendation booking has correct room allocations.',
  'Desktop Edge', 5
),
(
  'a0000000-0000-0000-0000-000000000001', 'F',
  'iPhone: Mobile Booking + Basket Share',
  '1. Open the URL in Safari → tap Search → a bottom sheet opens (Hotel → Dates → Guests)
2. Pick dates in the vertical scrolling calendar → set guests → search
3. Check: bottom nav shows item count + total price. Tap it → basket sheet opens (80vh)
4. Verify: no zoom on input focus, keyboard dismisses on scroll, no horizontal overflow
5. Check the calendar shows per-day prices and special offer badges (if any)
6. Open a room''s image gallery → swipe images, pinch-to-zoom, play video if available
7. Complete the full funnel: Availabilities → Add-ons → Summary → Payment → Confirmation
8. Basket Share: Add room(s) → tap Share button → copy link → open in a different browser or incognito → basket restores → can complete checkout',
  'iPhone Safari', 6
),
(
  'a0000000-0000-0000-0000-000000000001', 'G',
  'Android: Mobile + Promo & Discount Codes',
  '1. Open URL in Chrome → search sheet, calendar, room selection — same as iPhone flow
2. Check: Android back button works, keyboard handling OK, no layout overflow
3. Search with adults + children → verify room cards show correct guest counts
4. Complete at least one full booking → confirm prices on confirmation page
5. Promo code: In the search bar, enter a promo code → validation spinner → ✓ or ✗
6. Open URL with ?discountCode=TESTCODE → code should pre-fill
7. Verify: promo badge, strikethrough price, discounted amount is correct
8. Complete checkout with discount → discount reflected in basket and confirmation',
  'Android Chrome', 7
),
(
  'a0000000-0000-0000-0000-000000000001', 'H',
  'iPad: Tablet Layout + Currency & Language',
  '1. Open URL on iPad → verify 2-column grid on availabilities, bottom nav visible, basket sheet works
2. Rotate: portrait ↔ landscape — layout adapts, no overflow, no broken grids
3. Currency: Switch GBP → EUR — all prices update across all pages. Try switching mid-funnel
4. Language: Switch to another language — text updates, calendar names, date formats change
5. Complete a full booking in non-default language + currency
6. On confirmation: prices show in selected currency, text in selected language',
  'iPad Safari', 8
),
(
  'a0000000-0000-0000-0000-000000000001', 'I',
  'GXP Tag: Embedded / Modal Mode',
  '1. Go to the tag test page → click the "Book Now" floating button on the right side → the IBE opens in a modal / iframe
2. Check: close (X) button visible in the top bar. Pressing it should close the modal
3. Verify: reduced padding, full-width content, no horizontal overflow inside the modal
4. Complete the full funnel inside the modal: Search → Availabilities → Room → Add-ons → Summary → Payment → Confirmation
5. Resize browser window with modal open — layout adapts, dialogs stay in bounds
6. Open calendar and popovers — they should not overflow outside the iframe
7. Open DevTools console — no cross-origin errors
8. If possible, open the tag test page on a mobile device too',
  NULL, 9
),
(
  'a0000000-0000-0000-0000-000000000001', 'J',
  'Dark Mode + Post-Booking Cleanup',
  '1. Toggle dark mode on → check contrast on: calendar, room cards, forms, basket, confirmation
2. Complete an entire booking in dark mode
3. After confirmation, click "Book Another Room" → verify you''re back at availabilities with an empty basket
4. Verify: no stale form data, promo codes cleared, payment state cleared — fresh start
5. Test breadcrumbs: navigate the funnel, click a previous breadcrumb → state preserved
6. If a single-hotel group is available — open it → verify auto-redirect skips hotel selection
7. Search dates with no availability → verify a clear "no results" message appears',
  NULL, 10
),
(
  'a0000000-0000-0000-0000-000000000001', 'K',
  'Date Conflict + Basket Recovery',
  '1. Add a room to your basket for dates A (e.g. June 10–12)
2. Now change the search to dates B (e.g. June 20–22) and try to add another room
3. A Date Conflict Dialog should appear with two options: "Complete current booking" and "Start new basket"
4. Test both options — each should work correctly (one keeps old basket, one clears it)
5. Basket Share: Add rooms → click Share → copy link → open in different browser → basket restores
6. Share from desktop → open on mobile (or vice versa) → verify basket restores correctly
7. If a basket recovery link is available (?basketId=...&basketRecovery=true): open it → basket restores on summary with billing pre-filled → complete checkout

✓ PMS: If you completed a booking via recovery link, verify it reached PMS.',
  NULL, 11
),
(
  'a0000000-0000-0000-0000-000000000001', 'L',
  'Calendar Pricing + Hotel Map',
  '1. Open the search calendar → verify per-day prices load inside each day cell
2. Check for special offer badges on discounted dates (if any exist)
3. Switch to a different hotel → calendar prices should update
4. Navigate to a multi-hotel group home page (if available)
5. Verify the hotel map renders: markers show prices, clicking a marker opens an info window
6. Click "View" on a map marker → navigates to that property''s availabilities page
7. Open the cookie consent banner (clear cookies if needed) → test Accept, Reject, and Manage buttons
8. Complete a full booking to verify nothing broke',
  NULL, 12
),
(
  'a0000000-0000-0000-0000-000000000001', 'M',
  'Accessibility + Form Validation',
  '1. On the availabilities page, try navigating only with keyboard: Tab through room cards, press Enter to select
2. Check: focus rings visible on all interactive elements (buttons, links, inputs, cards)
3. On the Summary page, try submitting the form with all fields empty → validation errors should appear
4. Enter an invalid email (e.g. "abc") and invalid phone (e.g. "123") → specific error messages shown
5. Fill the form correctly but leave required fields blank one at a time → each shows an error
6. Try a deep link with full params: ?arrival=...&departure=...&adults=2 → search pre-fills correctly
7. Type a random/invalid URL path → a proper 404 / not-found page appears
8. Complete a full booking to verify nothing is broken',
  NULL, 13
),
(
  'a0000000-0000-0000-0000-000000000001', 'N',
  'Search & Guest Configuration',
  '1. Open the booking engine → try searching with 1 adult only → verify results show single-occupancy rates
2. Search with 2 adults + 2 children → set different ages for each child → verify child age selectors work
3. Search with 3 rooms, mixed guest counts (e.g. 2+1, 1+0, 2+2 children) → verify each room shows correct guest config
4. Try changing dates after searching → results update without errors
5. Search with check-in = today, 1-night stay → verify availability loads (edge case: same-day booking)
6. Search with dates far in the future (6+ months) → verify calendar scrolls and prices load
7. Clear all fields and try searching with missing required fields → proper validation messages appear
8. Complete a full booking with children included → verify guest counts on confirmation page

✓ PMS: Reservation shows correct number of adults and children per room.',
  'Desktop Edge', 14
)
on conflict do nothing;
