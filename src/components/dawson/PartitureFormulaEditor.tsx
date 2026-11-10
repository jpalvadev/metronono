import React, { useState } from 'react';
import { OrchestratedStroke, Dynamic } from '../../domain/dawson/types';
import { IDrumKitPlayer } from '../../audio/types';
import { FormulaPaletteToolbar, EntryTool } from './FormulaPaletteToolbar';
import { PartitureFormulaCanvas } from './PartitureFormulaCanvas';

export interface PartitureFormulaEditorProps {
  strokes: OrchestratedStroke[];
  onChangeStrokes: (strokes: OrchestratedStroke[]) => void;
  targetBeats?: number;
  player?: IDrumKitPlayer;
  width?: number;
  height?: number;
  readOnly?: boolean;
}

export const PartitureFormulaEditor: React.FC<PartitureFormulaEditorProps> = ({
  strokes,
  onChangeStrokes,
  targetBeats = 1.0,
  player,
  width = 560,
  height = 170,
  readOnly = false,
}) => {
  const [activeTool, setActiveTool] = useState<EntryTool>('note');
  const [selectedDuration, setSelectedDuration] = useState<number>(0.25);
  const [selectedDynamic, setSelectedDynamic] = useState<Dynamic>('normal');

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Top Palette Toolbar */}
      <FormulaPaletteToolbar
        selectedDuration={selectedDuration}
        onSelectDuration={setSelectedDuration}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedDynamic={selectedDynamic}
        onSelectDynamic={setSelectedDynamic}
        disabled={readOnly}
      />

      {/* Interactive 5-line PAS Percussion Canvas */}
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool={activeTool}
        selectedDuration={selectedDuration}
        selectedDynamic={selectedDynamic}
        targetBeats={targetBeats}
        player={player}
        width={width}
        height={height}
        readOnly={readOnly}
      />
    </div>
  );
};
