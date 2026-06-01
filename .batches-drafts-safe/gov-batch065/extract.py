#!/usr/bin/env python3
"""Extract governance data from DEF14A texts."""
import re, json, sys, os

EXTRACTED_DIR = '/tmp/gov-batch065/extracted'

def find_context(t, kw, ctx=400):
    i = t.find(kw)
    return t[max(0,i-50):i+ctx] if i>=0 else ''

def show(ticker, kw, ctx=1500):
    t = open(f'{EXTRACTED_DIR}/{ticker}.txt').read()
    for m in re.finditer(re.escape(kw), t):
        i = m.start()
        print(f'=== {kw} at {i} ===')
        print(t[max(0,i-100):i+ctx])
        print()

if __name__ == '__main__':
    show(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 1500)
