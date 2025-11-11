import process from 'node:process'

console.log(process.env)

console.log(process.env.ALIST_SPACE_KEY)

if(process.env.ALIST_SPACE_KEY) {
    console.log(process.env.ALIST_SPACE_KEY.length)
} else {
    console.log('ALIST_SPACE_KEY is not set')
}
