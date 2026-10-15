import { describe, expect, it } from 'vitest';
import { addDays, diffDays, formatDate, formatShortDate, lastOfMonth, shiftMonth, startOfDay, todayInTz, weekdayIndexMon0 } from '@/lib/dates';
import { formatRs, parseAmount } from '@/lib/money';
import { displayPhone, normalizePkMobile } from '@/lib/phone';
import { compareByUrgency, feeInfo } from '@/lib/status';
import { buildCheckinResult } from '@/lib/checkin-result';
import { initials } from '@/lib/avatar';
import { deviceLabel } from '@/lib/device-label';

describe('dates', () => {
  it('formats like "10 Oct 2026"', () => {
    expect(formatDate('2026-10-10')).toBe('10 Oct 2026');
    expect(formatDate('2026-12-05')).toBe('05 Dec 2026');
    expect(formatShortDate('2026-10-30')).toBe('30 Oct');
  });
  it('does calendar maths without time-zone drift', () => {
    expect(addDays('2026-10-01', 29)).toBe('2026-10-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-10-13', '2026-10-10')).toBe(3);
    expect(lastOfMonth('2028-02')).toBe('2028-02-29');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(weekdayIndexMon0('2026-10-01')).toBe(3); // Thursday
  });
  it('knows "today" in Karachi', () => {
    // 20:30 UTC on 9 Oct is 01:30 on 10 Oct in Pakistan.
    expect(todayInTz('Asia/Karachi', new Date('2026-10-09T20:30:00Z'))).toBe('2026-10-10');
    expect(startOfDay('2026-10-10', 'Asia/Karachi').toISOString()).toBe('2026-10-09T19:00:00.000Z');
  });
});

describe('money', () => {
  it('formats PKR', () => {
    expect(formatRs(2500)).toBe('Rs 2,500');
    expect(formatRs(24000)).toBe('Rs 24,000');
    expect(formatRs(0)).toBe('Rs 0');
  });
  it('parses typed amounts', () => {
    expect(parseAmount('Rs 2,500')).toBe(2500);
    expect(parseAmount('')).toBeNull();
  });
});

describe('phone', () => {
  it.each([
    ['0300 1234567', '+923001234567'],
    ['300-1234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['00923001234567', '+923001234567'],
  ])('normalises %s', (input, out) => expect(normalizePkMobile(input)).toBe(out));
  it('rejects landlines and junk', () => {
    expect(normalizePkMobile('091 5701234')).toBeNull();
    expect(normalizePkMobile('12345')).toBeNull();
  });
  it('displays local format', () => expect(displayPhone('+923456677881')).toBe('0345-6677881'));
});

describe('fee status', () => {
  const today = '2026-10-10';
  it('matches the design examples', () => {
    expect(feeInfo('2026-10-30', today)).toEqual({ status: 'active', daysLeft: 20, overdueDays: null });
    expect(feeInfo('2026-10-13', today)).toEqual({ status: 'due', daysLeft: 3, overdueDays: null });
    expect(feeInfo('2026-09-28', today)).toEqual({ status: 'overdue', daysLeft: null, overdueDays: 12 });
    expect(feeInfo(null, today).status).toBe('none');
  });
  it('treats the last day as still valid', () => {
    expect(feeInfo('2026-10-10', today)).toEqual({ status: 'due', daysLeft: 0, overdueDays: null });
    expect(feeInfo('2026-10-09', today).status).toBe('overdue');
  });
  it('sorts the most urgent first', () => {
    const list = [feeInfo('2026-10-30', today), feeInfo('2026-09-09', today), feeInfo('2026-10-12', today), feeInfo('2026-10-05', today)];
    expect(list.sort(compareByUrgency).map((x) => x.overdueDays ?? x.daysLeft)).toEqual([31, 5, 2, 20]);
  });
});

describe('check-in result', () => {
  const member = { id: 'm1', no: 1004, name: 'Hamza Yousaf', photoUrl: null, planName: 'Monthly', planPrice: 2500, planDays: 30 };
  it('asks overdue members to pay', () => {
    const r = buildCheckinResult({
      checkinId: 'c',
      member: { ...member, validTill: '2026-09-28' },
      visitsThisMonth: 5,
      method: 'phone',
      at: '2026-10-10T10:00:00Z',
      today: '2026-10-10',
    });
    expect(r).toMatchObject({ status: 'overdue', overdueDays: 12, amountDue: 2500 });
  });
  it('shows no amount for active members', () => {
    const r = buildCheckinResult({
      checkinId: 'c',
      member: { ...member, validTill: '2026-10-30' },
      visitsThisMonth: 9,
      method: 'keypad',
      at: '2026-10-10T10:00:00Z',
      today: '2026-10-10',
    });
    expect(r).toMatchObject({ status: 'active', daysLeft: 20, amountDue: null, repeat: false });
  });
});

describe('misc', () => {
  it('makes initials', () => {
    expect(initials('Ali Khan')).toBe('AK');
    expect(initials('Kamran Ahmed Yousafzai')).toBe('KY');
    expect(initials('Sana')).toBe('S');
  });
  it('names phones', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A) AppleWebKit')).toBe('Android · SM-A546E');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit')).toBe('Android phone');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iPhone');
  });
});
