import * as fs from 'fs';
import { Helper } from "./Helper";
import { BranchFailurePath, BranchCondition } from "./ViperProtocol";

export class BranchTree {
  public condition: string;
  public left : BranchTree;
  public right : BranchTree;
  public leftResFatalCount : number;
  public rightResFatalCount : number;
  public isLeaf : boolean;

  constructor(condition: string = undefined,
            left: BranchTree = undefined,
            right: BranchTree = undefined,
            leftResFatalCount: number = 0,
            rightResFatalCount: number = 0,
            isLeaf: boolean = false) {
      this.condition = condition;
      this.left = left;
      this.right = right;
      this.leftResFatalCount = leftResFatalCount;
      this.rightResFatalCount = rightResFatalCount;
      this.isLeaf = isLeaf;
  }
  public isLeftFatal() : boolean { return this.leftResFatalCount > 0;}
  public isRightFatal() : boolean { return this.rightResFatalCount > 0; }

  public static DotFilePath = `${Helper.getLogDir()}/BranchTree.dot`;

  private static generatePathRec(expressions: BranchCondition[], errorCount: number, result: BranchTree): BranchTree {
    if (expressions.length === 0) {
      return result;
    } else {
      const lastCond = expressions.pop();
      if (lastCond.negated) {
        return BranchTree.generatePathRec(expressions, 
                                          errorCount, 
                                          new BranchTree(lastCond.condition, 
                                            result, BranchTree.getLeaf(), errorCount, 0, false)
                                        );
      } else {
        return BranchTree.generatePathRec(expressions, 
                                          errorCount, 
                                          new BranchTree(lastCond.condition, 
                                            BranchTree.getLeaf(), result, 0, errorCount, false)
                                        );
      }
    }
  }

  private static getLeaf() : BranchTree {
    return new BranchTree(undefined,undefined,undefined,0,0,true);
  }

  public static generate(exploredPaths: BranchFailurePath[]): BranchTree {
    if (exploredPaths.length === 0) {
      return BranchTree.getLeaf();
    } else {
      const tree = BranchTree.generatePathRec(exploredPaths[0].conditions,
        (exploredPaths[0].isResultFatal) ? 1 : -1, BranchTree.getLeaf()); // -1 or distinguishing successful from no result at leaves
      for (const path of exploredPaths.slice(1)) {
          tree.extend(path.conditions, path.isResultFatal);
      }
      return tree;
    }
  }

  private static incrementIfFatal(currBranchResultFatal: number, isResultFatal: boolean) : number {
    return isResultFatal && currBranchResultFatal>0 ? Math.max(currBranchResultFatal,0)+1 : currBranchResultFatal;
  }

  private extend(path : BranchCondition[], isResultFatal: boolean) : void  {
    if (this.isLeaf || path.length === 0) { return; }
    const negated = path[0].negated;
    const tail = path.slice(1);
    if (!this.left.isLeaf && tail.length > 0 && tail[0].condition === this.left.condition && negated) {
      this.leftResFatalCount = BranchTree.incrementIfFatal(this.leftResFatalCount,isResultFatal);
      this.left.extend(tail, isResultFatal);
    } else if (!this.right.isLeaf && tail.length > 0 && tail[0].condition === this.right.condition && !negated) {
      this.rightResFatalCount = BranchTree.incrementIfFatal(this.rightResFatalCount,isResultFatal);
      this.right.extend(tail, isResultFatal);
    } else {
      const errorCount = (isResultFatal) ?  1 : -1;
      const bfp = <BranchFailurePath>{conditions: tail, isResultFatal: isResultFatal};
      const subTree = BranchTree.generate([bfp]);// -1 for successful result
      if (negated) {
        this.left = subTree;
        this.leftResFatalCount = errorCount;
      } else {
        this.right = subTree;
        this.rightResFatalCount = errorCount;
      }
    }
  }


  private static even(n: number) : boolean { return (n & 1) === 0; }
  private buildTreeStrRec(fatalCount: number) : [string[], number, number] {
    if (this.isLeaf && fatalCount === -1) {
        return [["✔"], 0, 0];
    } else if (this.isLeaf && fatalCount > 0) {
        return [["Error"], 2, 2]; // ✘
    } else if (!this.isLeaf) {
        return this.buildTreeStr();
    } else {
        return [["?"], 0, 0];
    }
  }
  private static zip(left : string[], right: string[]) : string[]{
    const combined = [];
    const smallerStrVec = (left.length < right.length) ? left : right;
    const biggerStrVec = (left.length < right.length) ? right : left;
    const lenDiff = biggerStrVec.length - smallerStrVec.length;
    for (let i = 0; i < lenDiff; i++) {
       smallerStrVec.push(" ".repeat(smallerStrVec[0].length));
    }
    for (let i = 0; i < biggerStrVec.length; i++) {
      combined.push(left[i]+right[i]);
    }
    return combined;
  }
  private buildTreeStr() : [string[], number, number] {
    if (!this.isLeaf) {
        const expStr = this.condition;
        const expStrLen = expStr.length;

        let boxMiddle = "│ " + expStr + (BranchTree.even(expStrLen) ? " " : "") + " │";
        const boxLen = boxMiddle.length;
        const halfBoxLen = Math.floor(boxLen / 2);

        const leftTreeStr = this.left.buildTreeStrRec(this.leftResFatalCount);
        let leftStrVec = leftTreeStr[0];
        const prevLeftRightBoxLen = leftTreeStr[2];
        const rightTreeStr = this.right.buildTreeStrRec(this.rightResFatalCount);
        let rightStrVec = rightTreeStr[0];
        const prevRightLeftBoxLen = rightTreeStr[1];

        const halfExpStrLen = Math.floor(expStrLen / 2);
        const leftBoxLen = leftStrVec[0].length;
        const rightBoxLen = rightStrVec[0].length;

        let leftFiller = halfBoxLen - leftBoxLen;
        if (leftFiller > 0) {
          leftStrVec = leftStrVec.map(str => " ".repeat(leftFiller) + str);
          leftFiller = 0;
        } else {
          leftFiller = -leftFiller;
        }

        let rightFiller = halfBoxLen - rightBoxLen;
        if (rightFiller > 0) {
          rightStrVec = rightStrVec.map(str => str + " ".repeat(rightFiller));
          rightFiller = 0;
        } else {
          rightFiller = -rightFiller;
        }

        const boxTop = " ".repeat(leftFiller) + "┌─" + ("─".repeat(halfExpStrLen))
                    + "┴" + ("─".repeat(halfExpStrLen)) + "─┐" + " ".repeat(rightFiller);
        boxMiddle = " ".repeat(leftFiller) + boxMiddle + " ".repeat(rightFiller);
        const boxBottom = " ".repeat(leftFiller) + "└─" + "─".repeat(halfExpStrLen)
                      + "┬" + "─".repeat(halfExpStrLen) + "─┘" + " ".repeat(rightFiller);

        leftStrVec = leftStrVec.map(str => str + " ");

        leftStrVec = [" ".repeat(leftFiller+halfExpStrLen-prevLeftRightBoxLen) + "F┌" + "─".repeat(prevLeftRightBoxLen) + "┴", ...leftStrVec];
        rightStrVec = ["─".repeat(prevRightLeftBoxLen) + "┐T" + " ".repeat(rightFiller+halfExpStrLen-prevRightLeftBoxLen), ...rightStrVec];

        const combinedStrVec = BranchTree.zip(leftStrVec,rightStrVec);
        return [[boxTop, boxMiddle, boxBottom, ...combinedStrVec], leftFiller + halfBoxLen, rightFiller + halfBoxLen];
    } else {
      return  [[""], 0, 0] // Should not happen
    }
  }

  private static fill(vec : string[], filler :number): string[] {
    for (let i = 0; i < vec.length; i+=4) {
        vec[i] = " ".repeat(filler) + vec[i] + " ".repeat(filler);
        vec[i+1] = " ".repeat(filler) + vec[i+1] + "─".repeat(filler);
        vec[i+2] = " ".repeat(filler) + vec[i+2] + " ".repeat(filler);
        vec[i+3] = " ".repeat(filler) + vec[i+3] + " ".repeat(filler);
    }
    return vec;
  }
  private buildPathStr(maxBoxLen : number = 5) : string { // default =5 for 'Error'
    let path : string[] = [];
    const side : string[] = [];
    if (!this.isLeaf) {
      const expStr = this.condition;
      const halfExpStrLen = Math.floor(expStr.length / 2);
      const [pathTaken, pathNotTaken] = (this.isRightFatal()) ? ["T", "F"] : ["F","T"];

      const boxTop = "┌─" + ("─".repeat(halfExpStrLen)) + "┴" 
                      + ("─".repeat(halfExpStrLen)) + `─┐ ${pathNotTaken} `;
      const boxMiddle = "│ " + expStr + (BranchTree.even(expStr.length) ? " " : "") + " ├──";
      const boxBottom = "└─" + "─".repeat(halfExpStrLen) + "┬" + "─".repeat(halfExpStrLen) + "─┘   ";
      const conDown = " ".repeat(halfExpStrLen+2) + `│${pathTaken} ` + " ".repeat(halfExpStrLen);
      let box = [boxTop, boxMiddle, boxBottom, conDown];

      const boxLen = boxMiddle.length-2;
      const filler = Math.floor(Math.abs(maxBoxLen - boxLen) / 2);
      if (maxBoxLen > boxLen) {
        box = BranchTree.fill(box, filler);
      } else {
        path = BranchTree.fill(path, filler);
      }
      maxBoxLen = Math.max(maxBoxLen, boxLen);

      const fatalCount_= this.isRightFatal() ? this.leftResFatalCount : this.rightResFatalCount;
      const sideRes_ = (fatalCount_===1) ? ["\n"," ✔\n","\n","\n"] : 
                          (fatalCount_===0) ? ["\n"," ?\n","\n","\n"] 
                          : ["\n"," Error\n","\n","\n"];
      sideRes_.forEach(e => side.push(e));
     
      box.forEach(e => path.push(e));
      return this.isRightFatal() ? this.right.buildPathStr(maxBoxLen) : this.left.buildPathStr(maxBoxLen); // influenced by order of verification results (true branch results before left)
    } else {
        const filler = Math.floor(maxBoxLen/2);
        const combined = BranchTree.zip(path,side);
        return [(" ".repeat(filler) + "│" + " ".repeat(filler) + "\n"),
                    ...combined,
                    (" ".repeat(filler-2)+"Error\n")
                ]
          .reduce((str, s) => str + s);
    }
  }

  public getErrorCount(): number {
    if (this.isLeaf) {
      return Math.max(this.leftResFatalCount,0) + Math.max(this.rightResFatalCount,0);
    } else {
      return 0;
    }
  }

  public prettyPrint() : string {
    if (this.getErrorCount() === 1) {
      return this.buildPathStr();
    } else {
      return this.buildTreeStr()[0].reduce((str, s) => str + "\n" + s) + "\n";
    }
  }

  private static leafToDotNodeContent(fatalCount : number): string {
    if (fatalCount === -1) {
      return 'label="✔",shape="octagon",style="filled", fillcolor="palegreen"';
    } else if (fatalCount === 1) {
      return 'label="Error",shape="octagon",style="filled", fillcolor="lightsalmon"';
    } else {
      return 'label="?",shape="octagon",style="filled", fillcolor="lightgoldenrodyellow"';
    }
  }
  
  private writeDotFileRec(writer: fs.WriteStream, visitedCount : number = 0) : number {
    if (!this.isLeaf) {
        const parentIdn = `B${visitedCount}`;
        writer.write(`  ${parentIdn}[shape="square",label="${this.condition}"];\n`);
        const newVisitedCountLeft = visitedCount + 1;
        
        let visitedCountLeft = newVisitedCountLeft;
        if (this.left.isLeaf) {
          const leftLeafIdn = `B${newVisitedCountLeft}`;
          writer.write(`  ${leftLeafIdn}[${BranchTree.leafToDotNodeContent(this.leftResFatalCount)}];\n`);
          writer.write(`  ${parentIdn} -> ${leftLeafIdn} [label="F"];\n`);
        } else {
          const leftBranchIdn = `B${newVisitedCountLeft}`;
          const visitedCountLeft_ = this.left.writeDotFileRec(writer, newVisitedCountLeft)
          writer.write(`  ${parentIdn} -> ${leftBranchIdn}[label="F"];\n`);
          visitedCountLeft = visitedCountLeft_
        }

        const newVisitedCountRight = visitedCountLeft + 1;
        let visitedCountRight = newVisitedCountRight;
        if (this.right.isLeaf) {
          const rightLeafIdn = `B${newVisitedCountRight}`;
          writer.write(`  ${rightLeafIdn}[${BranchTree.leafToDotNodeContent(this.rightResFatalCount)}];\n`);
          writer.write(`  ${parentIdn} -> ${rightLeafIdn} [label="T"];\n`);
          newVisitedCountRight
        } else {
            const rightBranchIdn = `B${newVisitedCountRight}`;
            const visitedCountRight_ = this.right.writeDotFileRec(writer, newVisitedCountRight);
            writer.write(`  ${parentIdn} -> ${rightBranchIdn}[label="T"];\n`);
            visitedCountRight = visitedCountRight_;
        }
        return visitedCountRight
    } else {
      return 0;
    }
  }

  public async toDotFile(): Promise<void> {
    const writer = await fs.createWriteStream(BranchTree.DotFilePath);
    writer.write("digraph {\n");
    this.writeDotFileRec(writer);
    writer.write("}\n");
    await writer.close();
  }
}
