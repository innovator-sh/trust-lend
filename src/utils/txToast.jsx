import toast from 'react-hot-toast';
import React from 'react';
import { explorerTxUrl } from '../contracts/addresses';

function ScanLink({ hash }) {
    if (!hash) return null;
    const url = explorerTxUrl(hash);
    // A local chain has no block explorer.
    if (url === "#" || hash.startsWith("DEMO_TX")) {
        return <div className="text-[10px] text-[#8C8C8C] mt-1">Tx {hash.slice(0, 10)}…</div>;
    }

    return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 text-[#F5A623] hover:underline text-[11px]"
          onClick={(e) => e.stopPropagation()}
        >
            View on Polygonscan →
        </a>
    );
}

export function showTxLoading(message = "Confirming transaction...") {
    return toast.loading(message);
}

export function showTxSuccess(actionLabel, hash, toastId) {
    const content = (
        <div className="flex flex-col">
            <span className="font-bold">✓ {actionLabel} confirmed!</span>
            <ScanLink hash={hash} />
        </div>
    );
    if (toastId) {
        toast.success(content, { id: toastId });
    } else {
        toast.success(content);
    }
}

export function showTxError(humanMsg, toastId) {
    if (toastId) {
        toast.error(humanMsg, { id: toastId });
    } else {
        toast.error(humanMsg);
    }
}
