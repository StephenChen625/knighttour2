import React, { useState, useMemo, useRef, useEffect } from "react";

const KnightTourExplorer = () => {
  // 预设棋盘形状
  const presetBoards = {
    "3x4": {
      name: "3×4",
      pattern: Array(3)
        .fill()
        .map(() => Array(4).fill(true)),
    },
    "5x5": {
      name: "5×5",
      pattern: Array(5)
        .fill()
        .map(() => Array(5).fill(true)),
    },
    "8x8": {
      name: "8×8",
      pattern: Array(8)
        .fill()
        .map(() => Array(8).fill(true)),
    },
    cross: {
      name: "十字形",
      pattern: [
        [false, true, true, false],
        [true, true, true, true],
        [true, true, true, true],
        [false, true, true, false],
      ],
    },
  };

  const [selectedPreset, setSelectedPreset] = useState("cross");
  const [boardPattern, setBoardPattern] = useState(
    presetBoards["cross"].pattern
  );
  const [viewMode, setViewMode] = useState("board");
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [visitedSquares, setVisitedSquares] = useState(new Set());
  const [currentPosition, setCurrentPosition] = useState(null);
  const [showCellMarkers, setShowCellMarkers] = useState(false);
  const [showMoveCount, setShowMoveCount] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [moveHistory, setMoveHistory] = useState([]);
  const [graphMode, setGraphMode] = useState("move");
  const [gameStarted, setGameStarted] = useState(false);
  const canvasRef = useRef(null);
  const [draggingPoint, setDraggingPoint] = useState(null);

  // 为不同棋盘生成初始图论坐标
  const generateInitialNodePositions = (pattern, preset) => {
    const positions = {};
    const rows = pattern.length;
    const cols = pattern[0]?.length || 0;

    let validCells = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (pattern[i][j]) {
          validCells.push([i, j]);
        }
      }
    }

    // 根据棋盘大小调整布局
    const centerX = 300;
    const centerY = 250;

    if (preset === "cross") {
      // 十字形特殊布局 - 增大间距
      const crossPositions = {
        "0,1": { x: 220, y: 60 },
        "0,2": { x: 380, y: 60 },
        "1,0": { x: 100, y: 160 },
        "1,1": { x: 220, y: 160 },
        "1,2": { x: 380, y: 160 },
        "1,3": { x: 500, y: 160 },
        "2,0": { x: 100, y: 280 },
        "2,1": { x: 220, y: 280 },
        "2,2": { x: 380, y: 280 },
        "2,3": { x: 500, y: 280 },
        "3,1": { x: 220, y: 400 },
        "3,2": { x: 380, y: 400 },
      };
      return crossPositions;
    } else {
      // 矩形棋盘布局 - 根据不同棋盘设置不同间距
      let spacing;
      if (preset === "3x4") {
        spacing = 90; // 3×4较大间距
      } else if (preset === "5x5") {
        spacing = 70; // 5×5中等间距
      } else if (preset === "8x8") {
        spacing = 55; // 8×8适中间距，增大一些
      } else {
        spacing = Math.min(70, 400 / Math.max(rows, cols));
      }

      const startX = centerX - ((cols - 1) * spacing) / 2;
      const startY = centerY - ((rows - 1) * spacing) / 2;

      for (let [i, j] of validCells) {
        positions[`${i},${j}`] = {
          x: startX + j * spacing,
          y: startY + i * spacing,
        };
      }
      return positions;
    }
  };

  const [nodePositions, setNodePositions] = useState(() =>
    generateInitialNodePositions(presetBoards["cross"].pattern, "cross")
  );

  const validSquares = useMemo(() => {
    const squares = new Set();
    for (let i = 0; i < boardPattern.length; i++) {
      for (let j = 0; j < boardPattern[i].length; j++) {
        if (boardPattern[i][j]) {
          squares.add(`${i},${j}`);
        }
      }
    }
    return squares;
  }, [boardPattern]);

  // 骑士的移动方向
  const knightMoves = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  // 为每个坐标生成独特的标识
  const getCellMarker = (row, col) => {
    const index = row * 10 + col; // 假设最大10列，确保唯一性

    // 生成基于坐标的颜色，确保不会太浅
    const hue = ((row * 7 + col * 11) * 137.5) % 360;
    const saturation = 70;
    const lightness = 45; // 固定在45%，确保对比度

    // 生成标识符：A-Z, 0-9, 符号, 然后是组合
    const symbols =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789★☆♠♣♥♦●○△▲□■◇◆♪♫♀♂☀☽⚡⚠✓✗";
    let symbol;

    if (index < symbols.length) {
      symbol = symbols[index];
    } else {
      // 超出单个符号范围，使用两字母组合
      const firstChar = Math.floor((index - symbols.length) / 26);
      const secondChar = (index - symbols.length) % 26;
      symbol =
        String.fromCharCode(65 + firstChar) +
        String.fromCharCode(65 + secondChar);
    }

    return {
      color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      symbol: symbol,
    };
  };

  // 获取从某个位置可以到达的有效位置
  const getValidMoves = (row, col) => {
    const moves = [];
    knightMoves.forEach(([dr, dc]) => {
      const newRow = row + dr;
      const newCol = col + dc;
      if (validSquares.has(`${newRow},${newCol}`)) {
        moves.push([newRow, newCol]);
      }
    });
    return moves;
  };

  // 获取位置在移动历史中的顺序号
  const getMoveOrder = (row, col) => {
    const key = `${row},${col}`;
    const index = moveHistory.findIndex(([r, c]) => r === row && c === col);
    return index >= 0 ? index + 1 : null;
  };

  // 计算当前位置可达位置的出口数
  const getExitCountForMove = (row, col) => {
    if (!currentPosition) return null;
    const [currentRow, currentCol] = currentPosition;
    const validMoves = getValidMoves(currentRow, currentCol);
    const isReachable = validMoves.some(([r, c]) => r === row && c === col);

    if (!isReachable || visitedSquares.has(`${row},${col}`)) return null;

    return getValidMoves(row, col).filter(
      ([r, c]) => !visitedSquares.has(`${r},${c}`)
    ).length;
  };

  // 切换棋盘预设
  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setBoardPattern(presetBoards[preset].pattern);
    setNodePositions(
      generateInitialNodePositions(presetBoards[preset].pattern, preset)
    );
    resetGame();
  };

  // 设置高DPI Canvas
  const setupHighDPICanvas = (canvas) => {
    const ctx = canvas.getContext("2d");
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // 设置实际像素尺寸
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;

    // 缩放上下文以匹配设备像素比
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // 设置CSS尺寸
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    return ctx;
  };

  // 绘制图论视图
  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = setupHighDPICanvas(canvas);
    const canvasWidth = 600;
    const canvasHeight = 500;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 绘制连线
    Array.from(validSquares).forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const pos1 = nodePositions[key];
      const validMoves = getValidMoves(row, col);

      validMoves.forEach(([newRow, newCol]) => {
        const pos2 = nodePositions[`${newRow},${newCol}`];
        if (pos1 && pos2) {
          ctx.beginPath();
          ctx.moveTo(pos1.x, pos1.y);
          ctx.lineTo(pos2.x, pos2.y);
          ctx.strokeStyle = "#ccc";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });

    // 高亮当前位置的可达位置
    if (currentPosition) {
      const [currentRow, currentCol] = currentPosition;
      const currentPos = nodePositions[`${currentRow},${currentCol}`];
      const validMoves = getValidMoves(currentRow, currentCol);

      validMoves.forEach(([newRow, newCol]) => {
        const targetPos = nodePositions[`${newRow},${newCol}`];
        const targetKey = `${newRow},${newCol}`;
        if (currentPos && targetPos && !visitedSquares.has(targetKey)) {
          ctx.beginPath();
          ctx.moveTo(currentPos.x, currentPos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });
    }

    // 绘制已走过的路径
    if (showLines) {
      for (let i = 0; i < moveHistory.length - 1; i++) {
        const [row1, col1] = moveHistory[i];
        const [row2, col2] = moveHistory[i + 1];
        const pos1 = nodePositions[`${row1},${col1}`];
        const pos2 = nodePositions[`${row2},${col2}`];

        if (pos1 && pos2) {
          ctx.beginPath();
          ctx.moveTo(pos1.x, pos1.y);
          ctx.lineTo(pos2.x, pos2.y);
          ctx.strokeStyle = "#F97316";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }

    // 绘制节点
    Array.from(validSquares).forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const pos = nodePositions[key];
      const isVisited = visitedSquares.has(key);
      const isCurrent =
        currentPosition &&
        currentPosition[0] === row &&
        currentPosition[1] === col;
      const moveOrder = getMoveOrder(row, col);
      const exitCount = getExitCountForMove(row, col);
      const isValidMove =
        currentPosition &&
        getValidMoves(currentPosition[0], currentPosition[1]).some(
          ([r, c]) => r === row && c === col
        ) &&
        !isVisited;

      if (pos) {
        // 绘制节点圆圈
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 25, 0, 2 * Math.PI);

        if (isCurrent) {
          ctx.fillStyle = "#fca5a5"; // bg-red-300
        } else if (isValidMove) {
          ctx.fillStyle = "#bbf7d0"; // bg-green-200
        } else if (isVisited) {
          ctx.fillStyle = "#bfdbfe"; // bg-blue-200
        } else {
          ctx.fillStyle = "#f3f4f6"; // bg-gray-100
        }

        ctx.fill();
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制格子标识符
        if (showCellMarkers) {
          const marker = getCellMarker(row, col);
          // 在节点右上角显示小圆点标识
          ctx.beginPath();
          ctx.arc(pos.x + 15, pos.y - 15, 8, 0, 2 * Math.PI);
          ctx.fillStyle = marker.color;
          ctx.fill();
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1;
          ctx.stroke();

          // 在小圆点中显示符号，确保对比度
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 0.5;
          ctx.font =
            'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // 先描边再填充，增加对比度
          ctx.strokeText(marker.symbol, pos.x + 15, pos.y - 15);
          ctx.fillText(marker.symbol, pos.x + 15, pos.y - 15);
        }

        // 绘制内容
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (isCurrent) {
          // 骑士符号
          ctx.fillStyle = "#000";
          ctx.font =
            '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText("♘", pos.x, pos.y);
        } else if (showPath && moveOrder) {
          // 移动顺序号
          ctx.fillStyle = "#1f2937";
          ctx.font =
            'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(moveOrder.toString(), pos.x, pos.y);
        } else if (showMoveCount && exitCount !== null) {
          // 出口数徽章背景
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI);
          ctx.fillStyle = "#a855f7"; // bg-purple-500
          ctx.fill();

          // 出口数文字
          ctx.fillStyle = "#fff";
          ctx.font =
            'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(exitCount.toString(), pos.x, pos.y);
        } else if (isVisited) {
          // 已访问标记
          ctx.fillStyle = "#6b7280";
          ctx.font =
            '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText("·", pos.x, pos.y);
        }
      }
    });
  };

  // Canvas事件处理
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (graphMode === "drag") {
      for (const [key, pos] of Object.entries(nodePositions)) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < 25) {
          setDraggingPoint(key);
          break;
        }
      }
    } else {
      for (const [key, pos] of Object.entries(nodePositions)) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < 25) {
          const [row, col] = key.split(",").map(Number);
          handleSquareClick(row, col);
          break;
        }
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (graphMode === "drag" && draggingPoint) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setNodePositions((prev) => ({
        ...prev,
        [draggingPoint]: { x, y },
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingPoint(null);
  };

  // 重绘图形
  useEffect(() => {
    if (viewMode === "graph") {
      drawGraph();
    }
  }, [
    viewMode,
    nodePositions,
    visitedSquares,
    currentPosition,
    showCellMarkers,
    moveHistory,
    showMoveCount,
    showPath,
    showLines,
  ]);

  // 处理格子点击
  const handleSquareClick = (row, col) => {
    const key = `${row},${col}`;
    setSelectedSquare(key);

    if (!gameStarted) {
      // 开始游戏
      setCurrentPosition([row, col]);
      setVisitedSquares(new Set([key]));
      setMoveHistory([[row, col]]);
      setGameStarted(true);
    } else {
      // 检查是否是有效移动
      const [currentRow, currentCol] = currentPosition;
      const validMoves = getValidMoves(currentRow, currentCol);
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col);

      if (isValidMove && !visitedSquares.has(key)) {
        setCurrentPosition([row, col]);
        setVisitedSquares(new Set([...visitedSquares, key]));
        setMoveHistory((prev) => [...prev, [row, col]]);
      }
    }
  };

  // 重置游戏
  const resetGame = () => {
    setCurrentPosition(null);
    setVisitedSquares(new Set());
    setSelectedSquare(null);
    setMoveHistory([]);
    setGameStarted(false);
  };

  // 撤销上一步
  const undoMove = () => {
    if (moveHistory.length > 1) {
      const newHistory = moveHistory.slice(0, -1);
      const newVisited = new Set(newHistory.map(([r, c]) => `${r},${c}`));
      const [lastRow, lastCol] = newHistory[newHistory.length - 1];

      setMoveHistory(newHistory);
      setVisitedSquares(newVisited);
      setCurrentPosition([lastRow, lastCol]);
    } else if (moveHistory.length === 1) {
      resetGame();
    }
  };

  // 获取格子背景色类名
  const getCellBackgroundClass = (
    isKnightPosition,
    isValidMove,
    isStartPosition,
    isVisited
  ) => {
    if (isKnightPosition) {
      return "bg-red-300";
    } else if (isValidMove && gameStarted) {
      return "bg-green-200 hover:bg-green-300";
    } else if (isStartPosition) {
      return "bg-yellow-200 hover:bg-yellow-300";
    } else if (isVisited) {
      return "bg-blue-200";
    } else {
      return "bg-gray-100";
    }
  };

  // 渲染棋盘视图
  const renderBoardView = () => {
    const board = [];
    const rows = boardPattern.length;
    const cols = boardPattern[0]?.length || 0;

    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const isValid = boardPattern[i][j];

        if (isValid) {
          const key = `${i},${j}`;
          const isVisited = visitedSquares.has(key);
          const isCurrent =
            currentPosition &&
            currentPosition[0] === i &&
            currentPosition[1] === j;
          const isSelected = selectedSquare === key;
          const moveOrder = getMoveOrder(i, j);
          const exitCount = getExitCountForMove(i, j);
          const isValidMove =
            currentPosition &&
            getValidMoves(currentPosition[0], currentPosition[1]).some(
              ([r, c]) => r === i && c === j
            ) &&
            !isVisited;
          const isStartPosition = !gameStarted;

          const backgroundClass = getCellBackgroundClass(
            isCurrent,
            isValidMove,
            isStartPosition,
            isVisited
          );
          let cellClass = `w-14 h-14 border border-slate-400 flex items-center justify-center cursor-pointer relative transition-all duration-200 ${backgroundClass}`;

          if (isSelected) {
            cellClass += " ring-4 ring-blue-500";
          }

          row.push(
            <div
              key={j}
              className={cellClass}
              onClick={() => handleSquareClick(i, j)}
            >
              <div className="flex items-center justify-center w-full h-full">
                {isCurrent ? (
                  <span className="text-2xl">♘</span>
                ) : showPath && moveOrder ? (
                  <span className="text-lg font-bold leading-none">
                    {moveOrder}
                  </span>
                ) : showMoveCount && exitCount !== null ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-purple-500 rounded-full shadow-sm">
                    {exitCount}
                  </span>
                ) : isVisited ? (
                  <span className="text-lg">·</span>
                ) : null}
              </div>

              {/* 格子标识符 */}
              {showCellMarkers && (
                <div
                  className="absolute top-1 right-1 w-4 h-4 rounded-full border border-black flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: getCellMarker(i, j).color,
                    textShadow: "0 0 2px rgba(0,0,0,0.8)",
                  }}
                >
                  {getCellMarker(i, j).symbol}
                </div>
              )}
            </div>
          );
        } else {
          row.push(<div key={j} className="w-14 h-14"></div>);
        }
      }
      board.push(
        <div key={i} className="flex">
          {row}
        </div>
      );
    }
    return board;
  };

  const totalCells = validSquares.size;
  const visitedCount = visitedSquares.size;
  const gameComplete = visitedCount === totalCells && gameStarted;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-slate-800">
          骑士旅行启发式探索工具
        </h1>

        {/* 控制面板 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 mb-6">
          {/* 棋盘选择和视图切换 */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                棋盘类型：
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(presetBoards).map(([key, board]) => (
                  <option key={key} value={key}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setViewMode("board")}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === "board"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              棋盘视图
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === "graph"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              图论视图
            </button>

            {viewMode === "graph" && (
              <button
                onClick={() =>
                  setGraphMode(graphMode === "move" ? "drag" : "move")
                }
                className={`px-4 py-2 rounded-lg transition-all ${
                  graphMode === "drag"
                    ? "bg-green-500 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                {graphMode === "move" ? "🚀 移动模式" : "🖱️ 拖拽模式"}
              </button>
            )}

            <button
              onClick={resetGame}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md"
            >
              重新开始
            </button>
          </div>

          {/* 显示选项 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showMoveCount}
                onChange={(e) => setShowMoveCount(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                显示下一步出口数
              </span>
            </label>
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showPath}
                onChange={(e) => setShowPath(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                记录行动序号
              </span>
            </label>
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showLines}
                onChange={(e) => setShowLines(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                显示移动路线
              </span>
            </label>
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showCellMarkers}
                onChange={(e) => setShowCellMarkers(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                显示格子标识
              </span>
            </label>
          </div>

          {/* 游戏状态 */}
          <div className="flex justify-between items-center">
            <div className="text-sm">
              {!gameStarted ? (
                <span className="text-blue-600 font-medium">
                  🎯 请选择起始位置
                </span>
              ) : (
                <span className="text-slate-600">
                  进度：
                  <span className="font-semibold text-slate-800">
                    {visitedCount}
                  </span>
                  <span className="text-slate-500">/{totalCells}</span>
                </span>
              )}
            </div>

            {gameStarted && (
              <button
                onClick={undoMove}
                disabled={moveHistory.length === 0}
                className="px-3 py-1 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
              >
                撤销
              </button>
            )}
          </div>

          {/* 进度条 */}
          {gameStarted && (
            <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${(visitedCount / totalCells) * 100}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* 完成提示 */}
        {gameComplete && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl">
            🎉 恭喜！你完成了骑士巡游，访问了所有{totalCells}个格子！用了
            {moveHistory.length - 1}步
          </div>
        )}

        {/* 主显示区域 */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-6">
            {viewMode === "board" ? (
              <div className="inline-block">{renderBoardView()}</div>
            ) : (
              <canvas
                ref={canvasRef}
                width={600}
                height={500}
                className={`border-2 border-gray-300 rounded-lg shadow-lg ${
                  graphMode === "drag" ? "cursor-grab" : "cursor-pointer"
                }`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => setDraggingPoint(null)}
              />
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
          <h3 className="font-bold text-slate-800 mb-3">
            Warnsdorff启发式规则
          </h3>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              • 每一步都选择
              <span className="font-bold text-blue-600">下一步出口数最少</span>
              的位置，避免过早陷入死角
            </p>
            <p className="flex items-center">
              •{" "}
              <span className="inline-block w-4 h-4 bg-green-200 border border-slate-400 mr-2 ml-1"></span>
              绿色格子能走，
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-purple-500 rounded-full shadow-sm ml-1 mr-1">
                3
              </span>
              代表出口数
            </p>
            <p className="flex items-center">
              •{" "}
              <span className="inline-block w-4 h-4 bg-blue-200 border border-slate-400 mr-2 ml-1"></span>
              蓝色格子已走过，大数字显示步数序号
            </p>
            <p className="flex items-center">
              •{" "}
              <span className="inline-block w-8 h-0.5 bg-orange-500 mr-2 ml-1"></span>
              橙色线段显示移动路径
            </p>
            <p className="flex items-center">
              •{" "}
              <span
                className="inline-block w-4 h-4 rounded-full mr-2 ml-1 border border-black"
                style={{ backgroundColor: "hsl(120, 70%, 45%)" }}
              ></span>
              <span
                className="text-xs font-bold text-white"
                style={{ textShadow: "0 0 2px rgba(0,0,0,0.8)" }}
              >
                A
              </span>
              <span className="ml-1">
                彩色标识帮助识别格子对应关系（拖拽后仍可识别）
              </span>
            </p>
            <p>
              • 图论视图：
              {graphMode === "move" ? "点击节点移动骑士" : "拖拽节点重新布局"}
              ，绿色线表示可走路径
            </p>
          </div>
        </div>
      </div>
      <footer className="mt-8 w-full text-center text-sm text-gray-500">
        © {new Date().getFullYear()} 孙维刚教育研究院-陈硕老师 保留所有权利。
      </footer>
    </div>
  );
};

export default KnightTourExplorer;
