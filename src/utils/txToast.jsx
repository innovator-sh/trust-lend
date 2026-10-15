import toast from 'react-hot-toast';
import React from 'react';

function ScanLink({ hash }) {
    if (!hash) return null;
    // Hardhat local tx hashes are 66 chars too. We need to know if we are on local network.
    // However, for simplicity in this toast, we can check if it starts with 'DEMO_TX' or use a separate prop.
    // But let's just use the chainId if we can, or just check the hash prefix.
    const isLocal = hash.startsWith("DEMO_TX") || hash.startsWith("0x") && hash.length !== 66; 
    // Actually, real local hardhat hashes are 66 chars. 
    // Let's just assume if it's not starting with '0x' it's a demo mock.
    
    if (hash.startsWith("DEMO_TX")) {
        return <div className="text-[10px] text-[#8C8C8C] mt-1">View in terminal</div>;
    }

    return (
        <a 
          href={`https://amoy.polygonscan.com/tx/${hash}`} 
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
