import { useState, useCallback, useRef } from 'react';

const HEX_CHARS = '0123456789abcdef';

function randomHex(length: number): string {
    return '0x' + Array.from({ length: Math.min(length, 64) }, () =>
        HEX_CHARS[Math.floor(Math.random() * 16)]
    ).join('');
}

/**
 * Hash scramble micro-interaction.
 * On trigger, characters flash through random hex values for 300ms
 * before resolving back to the real value.
 */
export function useHashScramble(realValue: string) {
    const [display, setDisplay] = useState(realValue);
    const [isScrambling, setIsScrambling] = useState(false);
    const intervalRef = useRef<number | null>(null);

    const scramble = useCallback(() => {
        if (isScrambling || !realValue || !realValue.startsWith('0x')) return;
        setIsScrambling(true);

        const hashPart = realValue.slice(2);
        let i = 0;

        intervalRef.current = window.setInterval(() => {
            setDisplay(randomHex(hashPart.length));
            i++;
            if (i > 8) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setDisplay(realValue);
                setIsScrambling(false);
            }
        }, 35);
    }, [realValue, isScrambling]);

    return { display, scramble, isScrambling };
}
