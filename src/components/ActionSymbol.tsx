import React from 'react';

type ActionKind = 'one' | 'two' | 'three' | 'free' | 'reaction';

export const ActionSymbol: React.FC<{ kind: ActionKind }> = ({ kind }) => (
  <span aria-hidden="true" className="action-symbol" style={{ WebkitMaskImage: `url(./assets/icons/action-symbols/${kind}.png)`, maskImage: `url(./assets/icons/action-symbols/${kind}.png)` }} />
);
