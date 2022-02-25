
export function euclideanDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function gradient(x1, y1, x2, y2) {
  return (y2-y1)/(x2-x1);
}


export function isInside(vertices, point) {
    if (vertices.length < 3) {
        return false;
    }

    let extreme = [999, point[1]];
    let v = 0, count = 0;
    do {
        let nextV = (v + 1) % vertices.length;

        if (doIntersect(vertices[v], vertices[nextV], point, extreme)) {
            if (orientation(vertices[v], point, vertices[nextV]) == 0) {
                return onSegment(vertices[v], point, vertices[nextV]);
            }

            count++;
        }
        
        v = nextV;
    } while (v != 0);

    return (count % 2 == 1);
}

function onSegment(p,q,r) {
    if (q[0] <= Math.max(p[0], r[0]) && 
        q[0] >= Math.min(p[0], r[0]) && 
        q[1] <= Math.max(p[1], r[1]) && 
        q[1] >= Math.min(p[1], r[1])) 
    {
        return true;
    } else {
        return false;
    }
}

function  doIntersect(p1,q1,p2,q2)
{
    // Find the four orientations needed for
        // general and special cases
        let o1 = orientation(p1, q1, p2);
        let o2 = orientation(p1, q1, q2);
        let o3 = orientation(p2, q2, p1);
        let o4 = orientation(p2, q2, q1);
  
        // General case
        if (o1 != o2 && o3 != o4)
        {
            return true;
        }
  
        // Special Cases
        // p1, q1 and p2 are collinear and
        // p2 lies on segment p1q1
        if (o1 == 0 && onSegment(p1, p2, q1))
        {
            return true;
        }
  
        // p1, q1 and p2 are collinear and
        // q2 lies on segment p1q1
        if (o2 == 0 && onSegment(p1, q2, q1))
        {
            return true;
        }
  
        // p2, q2 and p1 are collinear and
        // p1 lies on segment p2q2
        if (o3 == 0 && onSegment(p2, p1, q2))
        {
            return true;
        }
  
        // p2, q2 and q1 are collinear and
        // q1 lies on segment p2q2
        if (o4 == 0 && onSegment(p2, q1, q2))
        {
            return true;
        }
  
        // Doesn't fall in any of the above cases
        return false;
}

function orientation(p,q,r)
{
    let val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  
    if (val == 0)
    {
        return 0; // collinear
    }
    return (val > 0) ? 1 : 2; // clock or counterclock wise
}