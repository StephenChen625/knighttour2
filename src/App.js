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
  const containerRef = useRef(null);
  const [draggingPoint, setDraggingPoint] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 500 });

  // 响应式计算canvas和cell大小
  useEffect(() => {
    const updateSizes = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const maxWidth = Math.min(containerWidth - 32, 600); // 减去padding
        const maxHeight = Math.min(window.innerHeight * 0.6, 500);
        
        setCanvasSize({
          width: maxWidth,
          height: maxHeight
        });
      }
    };

    updateSizes();
    window.addEventListener('resize', updateSizes);
    return () => window.removeEventListener('resize', updateSizes);
  }, []);

  // 计算棋盘格子大小（响应式）
  const getCellSize = () => {
    if (!containerRef.current) return 56; // 默认14*4=56px
    
    const containerWidth = containerRef.current.offsetWidth;
    const maxCellSize = 56; // 最大格子大小
    const minCellSize = 32; // 最小格子大小
    const cols = boardPattern[0]?.length || 1;
    const rows = boardPattern.length;
    
    // 基于容器宽度计算
    const availableWidth = containerWidth - 64; // 减去padding和margin
    const cellSizeByWidth = Math.floor(availableWidth / cols);
    
    // 基于容器高度计算
    const availableHeight = window.innerHeight * 0.5; // 最多占屏幕高度的50%
    const cellSizeByHeight = Math.floor(availableHeight / rows);
    
    // 取较小值，并限制在范围内
    const calculatedSize = Math.min(cellSizeByWidth, cellSizeByHeight);
    return Math.max(minCellSize, Math.min(maxCellSize, calculatedSize));
  };

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

    // 根据canvas大小调整布局
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    if (preset === "cross") {
      // 十字形特殊布局 - 根据canvas大小调整间距
      const spacing = Math.min(canvasSize.width / 6, canvasSize.height / 6);
      const crossPositions = {
        "0,1": { x: centerX - spacing/2, y: centerY - spacing * 1.5 },
        "0,2": { x: centerX + spacing/2, y: centerY - spacing * 1.5 },
        "1,0": { x: centerX - spacing * 1.5, y: centerY - spacing/2 },
        "1,1": { x: centerX - spacing/2, y: centerY - spacing/2 },
        "1,2": { x: centerX + spacing/2, y: centerY - spacing/2 },
        "1,3": { x: centerX + spacing * 1.5, y: centerY - spacing/2 },
        "2,0": { x: centerX - spacing * 1.5, y: centerY + spacing/2 },
        "2,1": { x: centerX - spacing/2, y: centerY + spacing/2 },
        "2,2": { x: centerX + spacing/2, y: centerY + spacing/2 },
        "2,3": { x: centerX + spacing * 1.5, y: centerY + spacing/2 },
        "3,1": { x: centerX - spacing/2, y: centerY + spacing * 1.5 },
        "3,2": { x: centerX + spacing/2, y: centerY + spacing * 1.5 },
      };
      return crossPositions;
    } else {
      // 矩形棋盘布局 - 根据canvas大小和棋盘尺寸计算间距
      const maxSpacing = Math.min(canvasSize.width / (cols + 1), canvasSize.height / (rows + 1));
      const spacing = Math.min(maxSpacing * 0.8, 70);

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

  // 当canvas尺寸改变时重新计算节点位置
  useEffect(() => {
    setNodePositions(generateInitialNodePositions(boardPattern, selectedPreset));
  }, [canvasSize, boardPattern, selectedPreset]);

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
    const index = row * 10 + col;
    const hue = ((row * 7 + col * 11) * 137.5) % 360;
    const saturation = 70;
    const lightness = 45;

    const symbols =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789★☆♠♣♥♦●○△▲□■◇◆♪♫♀♂☀☽⚡⚠✓✗";
    let symbol;

    if (index < symbols.length) {
      symbol = symbols[index];
    } else {
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

    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;

    ctx.scale(devicePixelRatio, devicePixelRatio);

    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    return ctx;
  };

  // 绘制图论视图
  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = setupHighDPICanvas(canvas);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

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
        // 根据canvas大小调整节点大小
        const nodeRadius = Math.min(25, canvasSize.width / 25);
        
        // 绘制节点圆圈
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);

        if (isCurrent) {
          ctx.fillStyle = "#fca5a5";
        } else if (isValidMove) {
          ctx.fillStyle = "#bbf7d0";
        } else if (isVisited) {
          ctx.fillStyle = "#bfdbfe";
        } else {
          ctx.fillStyle = "#f3f4f6";
        }

        ctx.fill();
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制格子标识符
        if (showCellMarkers) {
          const marker = getCellMarker(row, col);
          const markerRadius = Math.min(12, nodeRadius * 0.5);
          const markerOffset = nodeRadius * 0.7;
          
          ctx.beginPath();
          ctx.arc(pos.x + markerOffset, pos.y - markerOffset, markerRadius, 0, 2 * Math.PI);
          ctx.fillStyle = marker.color;
          ctx.fill();
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 0.8;
          ctx.font = `bold ${Math.min(12, markerRadius)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeText(marker.symbol, pos.x + markerOffset, pos.y - markerOffset);
          ctx.fillText(marker.symbol, pos.x + markerOffset, pos.y - markerOffset);
        }

        // 绘制内容
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (isCurrent) {
          ctx.fillStyle = "#000";
          ctx.font = `${Math.min(24, nodeRadius)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText("♘", pos.x, pos.y);
        } else if (showPath && moveOrder) {
          ctx.fillStyle = "#1f2937";
          ctx.font = `bold ${Math.min(16, nodeRadius * 0.7)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText(moveOrder.toString(), pos.x, pos.y);
        } else if (showMoveCount && exitCount !== null) {
          const badgeRadius = Math.min(12, nodeRadius * 0.5);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, badgeRadius, 0, 2 * Math.PI);
          ctx.fillStyle = "#a855f7";
          ctx.fill();

          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.min(12, badgeRadius)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText(exitCount.toString(), pos.x, pos.y);
        } else if (isVisited) {
          ctx.fillStyle = "#6b7280";
          ctx.font = `${Math.min(20, nodeRadius)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillText("·", pos.x, pos.y);
        }
      }
    });
  };

  // 统一的指针事件处理
  const getPointerPosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.touches && e.touches.length > 0) {
      // 触摸事件
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      // 鼠标事件
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    return { x, y };
  };

  // 开始事件处理（鼠标按下或触摸开始）
  const handlePointerStart = (e) => {
    e.preventDefault(); // 防止触摸时的默认行为
    
    const { x, y } = getPointerPosition(e);
    const nodeRadius = Math.min(25, canvasSize.width / 25);

    if (graphMode === "drag") {
      for (const [key, pos] of Object.entries(nodePositions)) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < nodeRadius) {
          setDraggingPoint(key);
          break;
        }
      }
    } else {
      for (const [key, pos] of Object.entries(nodePositions)) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < nodeRadius) {
          const [row, col] = key.split(",").map(Number);
          handleSquareClick(row, col);
          break;
        }
      }
    }
  };

  // 移动事件处理（鼠标移动或触摸移动）
  const handlePointerMove = (e) => {
    if (graphMode === "drag" && draggingPoint) {
      e.preventDefault();
      const { x, y } = getPointerPosition(e);

      setNodePositions((prev) => ({
        ...prev,
        [draggingPoint]: { x, y },
      }));
    }
  };

  // 结束事件处理（鼠标释放或触摸结束）
  const handlePointerEnd = (e) => {
    e.preventDefault();
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
    canvasSize,
  ]);

  // 处理格子点击
  const handleSquareClick = (row, col) => {
    const key = `${row},${col}`;
    setSelectedSquare(key);

    if (!gameStarted) {
      setCurrentPosition([row, col]);
      setVisitedSquares(new Set([key]));
      setMoveHistory([[row, col]]);
      setGameStarted(true);
    } else {
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
    const cellSize = getCellSize();

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
          
          let cellClass = `border border-slate-400 flex items-center justify-center cursor-pointer relative transition-all duration-200 ${backgroundClass}`;

          if (isSelected) {
            cellClass += " ring-2 ring-blue-500";
          }

          // 根据格子大小调整字体
          const fontSize = cellSize < 40 ? 'text-xs' : cellSize < 50 ? 'text-sm' : 'text-lg';
          const knightSize = cellSize < 40 ? 'text-sm' : cellSize < 50 ? 'text-lg' : 'text-2xl';

          row.push(
            <div
              key={j}
              className={cellClass}
              style={{ width: cellSize, height: cellSize }}
              onClick={() => handleSquareClick(i, j)}
            >
              <div className="flex items-center justify-center w-full h-full">
                {isCurrent ? (
                  <span className={knightSize}>♘</span>
                ) : showPath && moveOrder ? (
                  <span className={`${fontSize} font-bold leading-none`}>
                    {moveOrder}
                  </span>
                ) : showMoveCount && exitCount !== null ? (
                  <span 
                    className={`inline-flex items-center justify-center text-xs font-semibold text-white bg-purple-500 rounded-full shadow-sm`}
                    style={{ 
                      width: Math.min(20, cellSize * 0.4), 
                      height: Math.min(20, cellSize * 0.4) 
                    }}
                  >
                    {exitCount}
                  </span>
                ) : isVisited ? (
                  <span className={fontSize}>·</span>
                ) : null}
              </div>

              {/* 格子标识符 */}
              {showCellMarkers && (
                <div
                  className="absolute top-0.5 right-0.5 rounded-full border border-black flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{
                    width: Math.min(16, cellSize * 0.3),
                    height: Math.min(16, cellSize * 0.3),
                    backgroundColor: getCellMarker(i, j).color,
                    textShadow: "0 0 2px rgba(0,0,0,0.8)",
                    fontSize: Math.min(10, cellSize * 0.2)
                  }}
                >
                  {getCellMarker(i, j).symbol}
                </div>
              )}
            </div>
          );
        } else {
          row.push(<div key={j} style={{ width: cellSize, height: cellSize }}></div>);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-2 sm:p-6" ref={containerRef}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-8 text-center text-slate-800">
          骑士旅行启发式探索工具
        </h1>

        {/* 控制面板 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-3 sm:p-6 mb-4 sm:mb-6">
          {/* 棋盘选择和视图切换 */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <label className="text-xs sm:text-sm font-medium text-slate-700 whitespace-nowrap">
                棋盘类型：
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="px-2 sm:px-3 py-1 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                viewMode === "board"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              棋盘视图
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
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
                className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
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
              className="px-2 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md text-xs sm:text-sm"
            >
              重新开始
            </button>
          </div>

          {/* 显示选项 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showMoveCount}
                onChange={(e) => setShowMoveCount(e.target.checked)}
                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                显示下一步出口数
              </span>
            </label>
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showPath}
                onChange={(e) => setShowPath(e.target.checked)}
                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                记录行动序号
              </span>
            </label>
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showLines}
                onChange={(e) => setShowLines(e.target.checked)}
                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                显示移动路线
              </span>
            </label>
            <label className="flex items-center space-x-2 group cursor-pointer">
              <input
                type="checkbox"
                checked={showCellMarkers}
                onChange={(e) => setShowCellMarkers(e.target.checked)}
                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                显示格子标识
              </span>
            </label>
          </div>

          {/* 游戏状态 */}
          <div className="flex justify-between items-center">
            <div className="text-xs sm:text-sm">
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
                className="px-2 sm:px-3 py-1 bg-orange-500 text-white text-xs sm:text-sm rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
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
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm sm:text-base">
            🎉 恭喜！你完成了骑士巡游，访问了所有{totalCells}个格子！用了
            {moveHistory.length - 1}步
          </div>
        )}

        {/* 主显示区域 */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 p-3 sm:p-6 max-w-full overflow-auto">
            {viewMode === "board" ? (
              <div className="inline-block">{renderBoardView()}</div>
            ) : (
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className={`border-2 border-gray-300 rounded-lg shadow-lg max-w-full h-auto ${
                  graphMode === "drag" ? "cursor-grab" : "cursor-pointer"
                }`}
                style={{
                  touchAction: 'none', // 防止触摸时的默认行为
                  width: canvasSize.width,
                  height: canvasSize.height
                }}
                onMouseDown={handlePointerStart}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerEnd}
                onMouseLeave={() => setDraggingPoint(null)}
                onTouchStart={handlePointerStart}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerEnd}
              />
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-3 sm:p-6">
          <h3 className="font-bold text-slate-800 mb-3 text-sm sm:text-base">
            Warnsdorff启发式规则
          </h3>
          <div className="text-xs sm:text-sm text-slate-600 space-y-2">
            <p>
              • 每一步都选择
              <span className="font-bold text-blue-600">下一步出口数最少</span>
              的位置，避免过早陷入死角
            </p>
            <p className="flex items-center">
              •{" "}
              <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-green-200 border border-slate-400 mr-2 ml-1"></span>
              绿色格子能走，
              <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-xs font-semibold text-white bg-purple-500 rounded-full shadow-sm ml-1 mr-1">
                3
              </span>
              代表出口数
            </p>
            <p className="flex items-center">
              •{" "}
              <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-blue-200 border border-slate-400 mr-2 ml-1"></span>
              蓝色格子已走过，大数字显示步数序号
            </p>
            <p className="flex items-center">
              •{" "}
              <span className="inline-block w-6 sm:w-8 h-0.5 bg-orange-500 mr-2 ml-1"></span>
              橙色线段显示移动路径
            </p>
            <p className="flex items-center">
              •{" "}
              <span
                className="inline-block w-3 h-3 sm:w-4 sm:h-4 rounded-full mr-2 ml-1 border border-black"
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
            <p className="text-xs text-slate-500">
              💡 移动端支持触摸操作：触摸可点击，长按拖拽可重新布局图论视图
            </p>
          </div>
        </div>
      </div>
      <footer className="mt-4 sm:mt-8 w-full text-center text-xs sm:text-sm text-gray-500">
        © {new Date().getFullYear()} 孙维刚教育研究院-陈硕老师 保留所有权利。
      </footer>
    </div>
  );
};

export default KnightTourExplorer;
