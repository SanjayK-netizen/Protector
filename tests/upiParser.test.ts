import { describe, it, expect } from 'vitest';
import { parseUpiPayload, isWebUrl, isShortenedUrl } from '../src/lib/upiParser';

describe('UPI and QR Payload Parser (upiParser)', () => {
  describe('parseUpiPayload - Standard UPI URIs', () => {
    it('parses a complete upi://pay URI with all parameters', () => {
      const raw =
        'upi://pay?pa=canteen@testbank&pn=Campus%20Canteen&am=120.00&cu=INR&tn=Lunch%20Combo&mc=5499&tr=TXN12345';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(true);
      expect(parsed.isUrl).toBe(false);
      expect(parsed.isShortenedUrl).toBe(false);
      expect(parsed.pa).toBe('canteen@testbank');
      expect(parsed.pn).toBe('Campus Canteen');
      expect(parsed.am).toBe(120.0);
      expect(parsed.cu).toBe('INR');
      expect(parsed.tn).toBe('Lunch Combo');
      expect(parsed.mc).toBe('5499');
      expect(parsed.tr).toBe('TXN12345');
      expect(parsed.username).toBe('canteen');
      expect(parsed.handle).toBe('testbank');
      expect(parsed.error).toBeUndefined();
    });

    it('handles uppercase UPI scheme (UPI://PAY)', () => {
      const raw = 'UPI://PAY?pa=library@testbank&pn=College%20Library&am=50.00';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(true);
      expect(parsed.pa).toBe('library@testbank');
      expect(parsed.pn).toBe('College Library');
      expect(parsed.username).toBe('library');
      expect(parsed.handle).toBe('testbank');
    });

    it('handles UPI URI with no amount or transaction note', () => {
      const raw = 'upi://pay?pa=bookstore@testbank&pn=Campus%20Bookstore';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(true);
      expect(parsed.pa).toBe('bookstore@testbank');
      expect(parsed.am).toBeUndefined();
      expect(parsed.tn).toBeUndefined();
      expect(parsed.error).toBeUndefined();
    });

    it('handles payee address without an @ symbol gracefully', () => {
      const raw = 'upi://pay?pa=singleword&pn=Student';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(true);
      expect(parsed.username).toBe('singleword');
      expect(parsed.handle).toBeUndefined();
    });
  });

  describe('parseUpiPayload - Scheme & Amount Error Handling', () => {
    it('flags upi://collect as an explicit parser error, not a web link', () => {
      const raw = 'upi://collect?pa=scammer@testbank&pn=CollectReq&am=100.00';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(false);
      expect(parsed.isUrl).toBe(false);
      expect(parsed.isShortenedUrl).toBe(false);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('collect');
    });

    it('flags negative amount as an explicit parser error', () => {
      const raw = 'upi://pay?pa=canteen@testbank&am=-50.00';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(true);
      expect(parsed.am).toBeUndefined();
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('negative');
    });

    it('flags non-numeric invalid amount string as an explicit parser error', () => {
      const raw = 'upi://pay?pa=canteen@testbank&am=invalid_num';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(true);
      expect(parsed.am).toBeUndefined();
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('Invalid or negative');
    });

    it('flags unsupported UPI schemes as explicit errors', () => {
      const raw = 'upi://mandate?pa=canteen@testbank';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('parseUpiPayload - Web Links & Shortened URLs', () => {
    it('identifies standard HTTPS URLs as non-UPI web links', () => {
      const raw = 'https://testbank-portal.test/exam-dues';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(false);
      expect(parsed.isUrl).toBe(true);
      expect(parsed.isShortenedUrl).toBe(false);
      expect(parsed.pa).toBeUndefined();
    });

    it('detects shortened URLs from bit.ly or tinyurl', () => {
      const bitly = 'https://bit.ly/student-fee-discount';
      const parsedBitly = parseUpiPayload(bitly);

      expect(parsedBitly.isUpi).toBe(false);
      expect(parsedBitly.isUrl).toBe(true);
      expect(parsedBitly.isShortenedUrl).toBe(true);

      const tiny = 'https://tinyurl.com/campus-pass';
      const parsedTiny = parseUpiPayload(tiny);
      expect(parsedTiny.isShortenedUrl).toBe(true);
    });

    it('handles arbitrary non-URL text', () => {
      const raw = 'Random text inside a QR code';
      const parsed = parseUpiPayload(raw);

      expect(parsed.isUpi).toBe(false);
      expect(parsed.isUrl).toBe(false);
      expect(parsed.isShortenedUrl).toBe(false);
    });
  });

  describe('Edge cases and helpers', () => {
    it('returns an error on empty or whitespace strings', () => {
      const empty = parseUpiPayload('');
      expect(empty.isUpi).toBe(false);
      expect(empty.error).toBeDefined();

      const spaces = parseUpiPayload('   ');
      expect(spaces.isUpi).toBe(false);
      expect(spaces.error).toBeDefined();
    });

    it('validates isWebUrl and isShortenedUrl helper functions', () => {
      expect(isWebUrl('http://example.test')).toBe(true);
      expect(isWebUrl('https://example.test')).toBe(true);
      expect(isWebUrl('www.example.test')).toBe(true);
      expect(isWebUrl('upi://pay?pa=abc@testbank')).toBe(false);
      expect(isWebUrl('upi://collect?pa=abc@testbank')).toBe(false);
      expect(isWebUrl('just some text')).toBe(false);

      expect(isShortenedUrl('https://t.co/abc')).toBe(true);
      expect(isShortenedUrl('https://is.gd/xyz')).toBe(true);
      expect(isShortenedUrl('https://testbank.org/fees')).toBe(false);
    });
  });
});
